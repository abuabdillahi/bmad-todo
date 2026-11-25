import type { Todo } from '@todo/contract';
import type { FailureKind } from '../api/client.ts';

/**
 * The client state that is not the cache (AD-11): one immutable snapshot per
 * change, read with `useSyncExternalStore`.
 */
export interface TodosSnapshot {
  /** A `['todos']` fetch has succeeded. */
  readonly loaded: boolean;
  /** The kind of the most recent recorded fetch failure, or null once a fetch succeeds. */
  readonly lastFetchFailure: FailureKind | null;
  /** Try again was pressed and its fetch hasn't been recorded yet. */
  readonly retryRequested: boolean;
  /** Todo mutations sent or queued (AD-13). */
  readonly pendingCount: number;
  /** When each todo's last revert happened (AD-13). */
  readonly revertedAt: ReadonlyMap<string, number>;
}

export interface TodosStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TodosSnapshot;
  recordFetchSuccess(): void;
  recordFetchFailure(kind: FailureKind): void;
  requestRetry(): void;
  mutationStarted(): void;
  mutationSettled(): void;
  recordRevert(id: string, at: number): void;
}

export type ListState = 'loading' | 'error' | 'populated' | 'empty';

export function createTodosStore(): TodosStore {
  let snapshot: TodosSnapshot = {
    loaded: false,
    lastFetchFailure: null,
    retryRequested: false,
    pendingCount: 0,
    revertedAt: new Map(),
  };
  const listeners = new Set<() => void>();

  function update(patch: Partial<TodosSnapshot>) {
    const changed = (Object.keys(patch) as (keyof TodosSnapshot)[]).some((key) => patch[key] !== snapshot[key]);
    if (!changed) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    recordFetchSuccess: () => update({ loaded: true, lastFetchFailure: null, retryRequested: false }),
    recordFetchFailure: (kind) => update({ lastFetchFailure: kind, retryRequested: false }),
    requestRetry: () => update({ retryRequested: true }),
    mutationStarted: () => update({ pendingCount: snapshot.pendingCount + 1 }),
    mutationSettled: () => update({ pendingCount: Math.max(0, snapshot.pendingCount - 1) }),
    recordRevert(id, at) {
      const revertedAt = new Map(snapshot.revertedAt);
      revertedAt.set(id, at);
      update({ revertedAt });
    },
  };
}

/**
 * The one list-state selector (AD-11). Before the first successful fetch the
 * list is in error when the last fetch failed and no retry is requested, and
 * loading otherwise. Once loaded it renders the cache: populated or empty.
 */
export function selectListState(snapshot: TodosSnapshot, cached: readonly Todo[] | undefined): ListState {
  if (!snapshot.loaded) {
    return snapshot.lastFetchFailure !== null && !snapshot.retryRequested ? 'error' : 'loading';
  }
  return cached !== undefined && cached.length > 0 ? 'populated' : 'empty';
}
