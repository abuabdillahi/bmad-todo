import type { QueryClient } from '@tanstack/react-query';
import type { Todo } from '@todo/contract';
import { createTodo, deleteTodo as sendDelete, RequestFailure, updateTodo } from '../api/client.ts';
import type { Announcer } from './announcer.ts';
import { messages, type FailureInfo } from './messages.ts';
import { todosQueryKey } from './query.ts';
import type { TodosStore } from './store.ts';

/** A call's outcome (AD-13). The promise that carries it never rejects. */
export type MutationOutcome =
  | { readonly status: 'ok' }
  | { readonly status: 'failed'; readonly failure: FailureInfo }
  | { readonly status: 'dropped' };

/**
 * An add's outcome, with its id (AD-7): the one the client minted, or the
 * failed add's id passed back. A failed add also carries the todo's text as the
 * follow-ups queued behind it left it (#70): the sent text, the last edit saved
 * on its card while it was pending, or null if a queued delete removed it.
 * Those follow-ups are still dropped (AD-13); only the add form reads this.
 */
export type AddOutcome =
  | (Exclude<MutationOutcome, { readonly status: 'failed' }> & { readonly id: string })
  | (Extract<MutationOutcome, { readonly status: 'failed' }> & {
      readonly id: string;
      readonly latestDescription: string | null;
    });

/** One optimistic change to one todo (AD-13). */
export interface MutationSpec {
  readonly id: string;
  /** A create starts the todo's chain; a follow-up waits for it, and is dropped if it failed. */
  readonly kind: 'create' | 'follow-up';
  /** The todo's new value from its current one; null removes it. */
  readonly apply: (prev: Todo | undefined) => Todo | null;
  /** Sends the request. A rejection is the call's failure. */
  readonly send: () => Promise<unknown>;
  /** The failure message, announced with kind `failure`. */
  readonly failureText: (failure: FailureInfo) => string;
  /** The status message, announced on server confirmation. */
  readonly successText?: string;
}

/** A follow-up's `not-found`, as the helper announced it: the todo's id and the failure text. */
export interface NotFoundRecord {
  readonly id: string;
  readonly text: string;
}

export interface MutationHelper {
  run(spec: MutationSpec): Promise<MutationOutcome>;
  /**
   * The last follow-up answered `not-found`: its todo's id and the text it
   * announced, recorded in the same step as the announce; null until one is.
   * The list area reads it so it doesn't announce the same loss twice (AD-14).
   */
  lastNotFound(): NotFoundRecord | null;
  /**
   * Adds the todo on top of the cache at once (AD-7, AD-13), with a freshly
   * minted id, or with `id` when resubmitting a failed add's unchanged text, so
   * an add the server already stored replays instead of being stored twice (AD-6).
   * A failed add resolves with `latestDescription`: the todo's text as its
   * queued follow-ups left it, or null if one deleted it (#70).
   */
  addTodo(description: string, id?: string): Promise<AddOutcome>;
  /**
   * Completes or reopens the todo at once (R4, R7), as a follow-up: behind a
   * pending create it waits, and is dropped if that create fails. A success
   * announces nothing; a failure announces the `complete` or `reopen` lead plus
   * the reason, or `deletedElsewhere` for `not-found`.
   */
  setCompleted(todo: Pick<Todo, 'id' | 'description'>, completed: boolean): Promise<MutationOutcome>;
  /**
   * Changes the todo's text at once (R13, R7), as a follow-up: behind a pending
   * create it waits, and is dropped if that create fails. `description` is
   * already prepared (AD-8), so the request and the cache carry the same
   * value. A success announces nothing; a failure announces the `edit` lead
   * plus the reason, or `deletedElsewhere` for `not-found`, quoting the text
   * the todo shows once reverted (the pre-edit text, or a later queued edit).
   */
  editDescription(todo: Pick<Todo, 'id' | 'description'>, description: string): Promise<MutationOutcome>;
  /**
   * Removes the todo at once (R5), as a follow-up: behind a pending create it
   * waits, and is dropped if that create fails. A 204, or a 404 (already gone),
   * is success: it announces `deleted` on server confirmation. Any other
   * failure puts the todo back at its place and announces the `delete` lead
   * plus the reason.
   */
  deleteTodo(todo: Pick<Todo, 'id' | 'description'>): Promise<MutationOutcome>;
}

export interface MutationHelperDeps {
  queryClient: QueryClient;
  store: TodosStore;
  announce: Announcer['announce'];
  now?: () => number;
}

/** One call on a todo, kept until it settles so a revert can rebuild the todo. */
interface Entry {
  readonly spec: MutationSpec;
  /** Its change is in the cache. */
  applied: boolean;
  /** The todo's value this call's change was applied on. */
  base: Todo | undefined;
  /** Where that value sat in the list, or -1 if it wasn't there. */
  index: number;
  /**
   * A failed create only: the todo as the follow-ups queued behind it left it,
   * worked out at the failure before they are dropped; null if one removed it.
   */
  latest?: Todo | null;
}

interface Chain {
  /** Settles when the todo's latest queued call has settled. */
  tail: Promise<unknown>;
  /** Calls queued on this id and not yet settled, in order. */
  pending: Entry[];
  /** The todo's latest executed create failed: the follow-ups queued behind it are dropped. */
  createFailed: boolean;
}

function failureInfo(error: unknown): FailureInfo {
  if (error instanceof RequestFailure) return { kind: error.kind, namesDescription: error.namesDescription };
  return { kind: 'generic' };
}

/**
 * The one optimistic-mutation helper (AD-13). Each call cancels in-flight
 * `['todos']` fetches, then changes its one todo in the cache at once. Calls on
 * the same id are sent in order. On failure only that todo is put back, its
 * revert time recorded and the failure announced; a failed create drops its
 * queued follow-ups. The settle-time refetch runs once no call is pending.
 */
export function createMutationHelper({ queryClient, store, announce, now = Date.now }: MutationHelperDeps): MutationHelper {
  const chains = new Map<string, Chain>();
  let notFound: NotFoundRecord | null = null;

  function readList(): Todo[] {
    return queryClient.getQueryData<Todo[]>(todosQueryKey) ?? [];
  }

  /** Writes one todo's value into the cache: in place, at `index`, or on top; undefined removes it. */
  function writeTodo(id: string, value: Todo | undefined, index: number): void {
    queryClient.setQueryData<Todo[]>(todosQueryKey, (current = []) => {
      const at = current.findIndex((todo) => todo.id === id);
      if (value === undefined) return at === -1 ? current : current.filter((todo) => todo.id !== id);
      if (at !== -1) return current.map((todo, i) => (i === at ? value : todo));
      if (index === -1) return [value, ...current];
      const to = Math.min(index, current.length);
      return [...current.slice(0, to), value, ...current.slice(to)];
    });
  }

  /** Applies the call's change on the todo's current value, and keeps that value as its base. */
  function applyToCache(entry: Entry): void {
    const list = readList();
    const index = list.findIndex((todo) => todo.id === entry.spec.id);
    const base = index === -1 ? undefined : list[index];
    const next = entry.spec.apply(base);
    entry.base = base;
    entry.index = index;
    entry.applied = true;
    writeTodo(entry.spec.id, next ?? undefined, -1);
  }

  /**
   * Puts back only this call's change (AD-13): rebuilds the todo from the
   * failed call's base by re-applying every later pending call on it, in order,
   * and moves their bases back so a later failure never restores a refused
   * value. A failed create removes the todo; its follow-ups are dropped, but a
   * resubmitted create queued after them, and its own follow-ups, stay.
   */
  function revert(entry: Entry, chain: Chain): void {
    const at = chain.pending.indexOf(entry);
    const resubmitted = chain.pending.findIndex((e, i) => i > at && e.spec.kind === 'create');
    const from = entry.spec.kind === 'follow-up' ? at + 1 : resubmitted;
    const later = from === -1 ? [] : chain.pending.slice(from).filter((e) => e.applied);
    if (!entry.applied) return;
    let value = entry.base;
    for (const next of later) {
      next.base = value;
      next.index = entry.index;
      try {
        value = next.spec.apply(value) ?? undefined;
      } catch {
        // A broken apply leaves the value as it was; that call fails on its own.
      }
    }
    writeTodo(entry.spec.id, value, entry.index);
  }

  /**
   * The todo as the user last left it behind a create (#70): the create's value
   * with every later pending call on it applied in order, up to a resubmitted
   * create, applied to the cache or not; null if one removed it.
   */
  function latestAfter(entry: Entry, chain: Chain): Todo | null {
    const at = chain.pending.indexOf(entry);
    let value: Todo | undefined;
    try {
      value = entry.spec.apply(undefined) ?? undefined;
    } catch {
      // A broken apply leaves the value as it was, as in revert.
    }
    for (const next of chain.pending.slice(at + 1)) {
      if (next.spec.kind === 'create') break;
      try {
        value = next.spec.apply(value) ?? undefined;
      } catch {
        // A broken apply leaves the value as it was, as in revert.
      }
    }
    return value ?? null;
  }

  function leave(entry: Entry, chain: Chain): void {
    const at = chain.pending.indexOf(entry);
    if (at !== -1) chain.pending.splice(at, 1);
  }

  /** Leaves the pending count first; the settle-time refetch runs once it reaches 0. */
  function settle(afterLeaving: () => void): void {
    store.mutationSettled();
    const idle = store.getSnapshot().pendingCount === 0;
    afterLeaving();
    if (idle) void queryClient.invalidateQueries({ queryKey: todosQueryKey });
  }

  async function execute(entry: Entry, chain: Chain, applied: Promise<void>): Promise<MutationOutcome> {
    const { spec } = entry;
    if (spec.kind === 'follow-up' && chain.createFailed) {
      leave(entry, chain);
      settle(() => {});
      return { status: 'dropped' };
    }
    // A resubmitted create starts over: the follow-ups queued behind it follow its outcome,
    // while those queued behind the earlier failed create have already run and been dropped.
    if (spec.kind === 'create') chain.createFailed = false;
    try {
      await applied;
      await spec.send();
    } catch (error) {
      const failure = failureInfo(error);
      if (spec.kind === 'create') {
        chain.createFailed = true;
        // Before the revert and the drop: what the queued follow-ups made of the todo.
        entry.latest = latestAfter(entry, chain);
      }
      settle(() => {
        revert(entry, chain);
        leave(entry, chain);
        store.recordRevert(spec.id, now());
        const text = spec.failureText(failure);
        if (spec.kind === 'follow-up' && failure.kind === 'not-found') notFound = { id: spec.id, text };
        announce('failure', text);
      });
      return { status: 'failed', failure };
    }
    leave(entry, chain);
    settle(() => {
      if (spec.successText !== undefined) announce('status', spec.successText);
    });
    return { status: 'ok' };
  }

  function run(spec: MutationSpec): Promise<MutationOutcome> {
    return enqueue(spec).outcome;
  }

  /** Queues the call on its todo's chain; the entry stays readable once it settles. */
  function enqueue(spec: MutationSpec): { entry: Entry; outcome: Promise<MutationOutcome> } {
    store.mutationStarted();

    let chain = chains.get(spec.id);
    if (!chain) {
      chain = { tail: Promise.resolve(), pending: [], createFailed: false };
      chains.set(spec.id, chain);
    }
    const own = chain;
    const entry: Entry = { spec, applied: false, base: undefined, index: -1 };
    own.pending.push(entry);

    // Cancel first, so the cancelled fetch can't put back what this writes.
    const applied = queryClient.cancelQueries({ queryKey: todosQueryKey }).then(() => applyToCache(entry));
    // A rejected apply is reported through the send step, never as an unhandled rejection.
    applied.catch(() => {});

    const outcome = own.tail
      .then(() => execute(entry, own, applied))
      .catch((): MutationOutcome => {
        leave(entry, own);
        return { status: 'failed', failure: { kind: 'generic' } };
      });
    own.tail = outcome;
    return {
      entry,
      outcome: outcome.finally(() => {
        if (own.pending.length === 0 && chains.get(spec.id) === own) chains.delete(spec.id);
      }),
    };
  }

  function addTodo(description: string, reusedId?: string): Promise<AddOutcome> {
    const id = reusedId ?? crypto.randomUUID();
    const todo: Todo = { id, description, completed: false, createdAt: new Date().toISOString() };
    const { entry, outcome } = enqueue({
      id,
      kind: 'create',
      apply: () => todo,
      send: () => createTodo({ id, description }),
      failureText: (failure) => messages.failureMessage('add', failure, description),
      successText: messages.added(description),
    });
    return outcome.then((result): AddOutcome => {
      if (result.status !== 'failed') return { ...result, id };
      // Nothing recorded (a failure outside the send step): the sent text.
      const latest = entry.latest === undefined ? description : (entry.latest?.description ?? null);
      return { ...result, id, latestDescription: latest };
    });
  }

  function setCompleted({ id, description }: Pick<Todo, 'id' | 'description'>, completed: boolean): Promise<MutationOutcome> {
    return run({
      id,
      kind: 'follow-up',
      apply: (prev) => (prev ? { ...prev, completed } : null),
      send: () => updateTodo(id, { completed }),
      failureText: (failure) =>
        failure.kind === 'not-found'
          ? messages.deletedElsewhere(description)
          : messages.failureMessage(completed ? 'complete' : 'reopen', failure, description),
    });
  }

  function editDescription(todo: Pick<Todo, 'id' | 'description'>, description: string): Promise<MutationOutcome> {
    const { id } = todo;
    // Read after the revert: a later queued edit re-applied on the restored value is what the card shows.
    const shown = () => readList().find((t) => t.id === id)?.description ?? todo.description;
    return run({
      id,
      kind: 'follow-up',
      apply: (prev) => (prev ? { ...prev, description } : null),
      send: () => updateTodo(id, { description }),
      failureText: (failure) =>
        failure.kind === 'not-found' ? messages.deletedElsewhere(shown()) : messages.failureMessage('edit', failure, shown()),
    });
  }

  function deleteTodo({ id, description }: Pick<Todo, 'id' | 'description'>): Promise<MutationOutcome> {
    return run({
      id,
      kind: 'follow-up',
      apply: () => null,
      send: () =>
        sendDelete(id).catch((error: unknown) => {
          // Already gone is what a delete wants (AD-13): never reverted.
          if (error instanceof RequestFailure && error.kind === 'not-found') return;
          throw error;
        }),
      failureText: (failure) => messages.failureMessage('delete', failure, description),
      successText: messages.deleted(description),
    });
  }

  return { run, lastNotFound: () => notFound, addTodo, setCompleted, editDescription, deleteTodo };
}
