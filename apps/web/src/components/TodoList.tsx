import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import type { Todo } from '@todo/contract';
import {
  useAnnounceDeletedElsewhere,
  useDeleteTodo,
  useListState,
  useReportRenderedIds,
  useRetryFetch,
  useTodosStore,
} from '../todos/hooks.ts';
import { messages } from '../todos/messages.ts';
import type { AnnouncerFocusTargets } from './Announcer.tsx';
import { isLive, mergeRows, withoutLeft, type LeavingEntry } from './leaving-rows.ts';
import { createLoadingStatus } from './loading-status.ts';
import { useTapOrigin } from './tap-origin.ts';
import { TodoCard, type CardConfirm, type CardEditing, type CardFocus } from './TodoCard.tsx';
import styles from './TodoList.module.css';

/** How long a Leaving row stays rendered: `--motion-duration-base`, mirrored. */
export const LEAVE_MS = 200;

/** The leave timer: `LEAVE_MS`, or 0 under reduced motion. */
function leaveDuration(): number {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return LEAVE_MS;
}

/** The one open row: in edit mode or in the Delete confirm, never both (EXPERIENCE Component Patterns › Todo card). */
type OpenRow = { readonly id: string; readonly mode: 'edit' | 'confirm' } | null;

/** The id of the row holding `node`, or null outside any row. */
function rowIdOf(node: EventTarget | null): string | null {
  return node instanceof Element ? (node.closest('li[data-todo-id]')?.getAttribute('data-todo-id') ?? null) : null;
}

/**
 * What holds focus in the list area, tracked because once it is detached
 * `document.activeElement` is already `<body>`: a row, the Todo list itself,
 * the Empty panel, or the List error panel (its Try again).
 */
type Focused = { readonly kind: 'row'; readonly id: string } | { readonly kind: 'list' | 'empty' | 'panel' } | null;

function sameFocused(a: Focused, b: Focused): boolean {
  if (a === null || b === null) return a === b;
  return a.kind === b.kind && (a.kind !== 'row' || a.id === (b as { id: string }).id);
}

/**
 * The one rule for focus off a removed row (EXPERIENCE Focus management): the
 * Completion check of the operable row now at `id`'s place among `ids`, else of
 * the one before it, else null. `before` is the order `id` held its place in;
 * its place is the number of rows before it there that are still in `ids`.
 * `ids` are the operable rows, in order, as `list` renders them.
 */
function checkAtPlaceOf(
  list: HTMLUListElement | null,
  id: string,
  before: readonly string[],
  ids: readonly string[],
): HTMLInputElement | null {
  const kept = new Set(ids);
  const at = before.slice(0, Math.max(0, before.indexOf(id))).filter((other) => kept.has(other)).length;
  const targetId = ids.length === 0 ? undefined : ids[Math.min(at, ids.length - 1)];
  const row = [...(list?.children ?? [])].find(
    (item) => item.getAttribute('data-todo-id') === targetId && !item.hasAttribute('data-leaving'),
  );
  return row?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
}

/** Three skeleton cards while loading (DESIGN Components › Skeleton card). */
const SKELETONS = [0, 1, 2] as const;

/**
 * The list area: the one observer of `['todos']` (AD-11). It renders the list
 * states from the one selector (AD-11, EXPERIENCE State Patterns › List
 * states): the Todo list whenever it has rows (before the first load too, so
 * an early card keeps its element), the skeleton list while loading, the List
 * error panel with Try again on error, and the Empty panel once loaded with no
 * row left. It owns the one Loading status (AD-14). It reports the ids it
 * renders to the add form (Add landed after all), owns the one open row (in
 * edit mode or the Delete confirm) and the per-todo failed drafts (EXPERIENCE
 * Component Patterns › Edit form, Todo card), keeps each user-deleted row as an
 * inert Leaving copy for its leave motion (AD-11), announces a row in edit mode
 * that a refetch removed (AD-14), and moves focus off a focused row, list,
 * Empty panel or List error panel that something other than a handler removed
 * (EXPERIENCE Focus management).
 */
export function TodoList({ focusTargets }: { focusTargets: AnnouncerFocusTargets }) {
  const { state, todos } = useListState();
  const { revertedAt, lastFetchFailure } = useTodosStore();
  const announceDeletedElsewhere = useAnnounceDeletedElsewhere();
  const deleteTodo = useDeleteTodo();
  const retry = useRetryFetch();
  const loaded = state === 'populated' || state === 'empty';
  const errorLine = state === 'error' ? messages.loadError(lastFetchFailure ?? 'generic') : '';
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // A card plays the enter motion only if it mounts while the list is not
  // loaded (only optimistic adds are there then) or once the list was already
  // loaded in the previous commit: cards arriving with the first load don't.
  const loadedBefore = useRef(loaded);
  useEffect(() => {
    loadedBefore.current = loaded;
  });
  const enter = !loaded || loadedBefore.current;

  useReportRenderedIds(todos);

  // One open row, in edit mode or the Delete confirm. Opening another row
  // replaces it, so an open form unmounts silently with its draft.
  const [open, setOpen] = useState<OpenRow>(null);
  const editingId = open?.mode === 'edit' ? open.id : null;
  const confirmingId = open?.mode === 'confirm' ? open.id : null;
  // Failed drafts per todo, until the page reloads. Read through stable closures,
  // so a save that settles after its card unmounted still keeps its draft.
  const drafts = useRef(new Map<string, string>());

  function editingFor(id: string): CardEditing {
    return {
      editing: id === editingId,
      open: () => setOpen({ id, mode: 'edit' }),
      close: () => setOpen((current) => (current?.id === id && current.mode === 'edit' ? null : current)),
      takeDraft: () => {
        const draft = drafts.current.get(id);
        drafts.current.delete(id);
        return draft;
      },
      keepDraft: (text) => drafts.current.set(id, text),
    };
  }

  // User-deleted rows kept rendered, inert, for their leave motion (AD-11).
  const [leaving, setLeaving] = useState<ReadonlyMap<string, LeavingEntry>>(() => new Map());
  const rows = mergeRows(todos, leaving, (id) => revertedAt.get(id));
  const leavingIds = new Set(rows.filter((row) => row.leaving).map((row) => row.todo.id));

  function confirmFor(todo: Todo, index: number): CardConfirm {
    const { id } = todo;
    return {
      confirming: id === confirmingId,
      open: () => setOpen({ id, mode: 'confirm' }),
      close: () => setOpen((current) => (current?.id === id && current.mode === 'confirm' ? null : current)),
      remove: () => {
        setLeaving((current) => new Map(current).set(id, { todo, index, revertedAt: revertedAt.get(id), settled: false }));
        setOpen((current) => (current?.id === id ? null : current));
        void deleteTodo(todo).then(() =>
          setLeaving((current) => {
            const entry = current.get(id);
            return entry === undefined ? current : new Map(current).set(id, { ...entry, settled: true });
          }),
        );
      },
    };
  }

  // Drops entries that no longer render (reverted, or settled with the todo in the cache), and
  // unmounts each Leaving copy whose todo has left the cache once its leave timer has run.
  const leaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const cached = new Set(todos.map((todo) => todo.id));
    const dead = [...leaving.values()].filter((entry) => !isLive(entry, cached, (id) => revertedAt.get(id)));
    for (const { todo } of dead) {
      clearTimeout(leaveTimers.current.get(todo.id));
      leaveTimers.current.delete(todo.id);
    }
    if (dead.length > 0) {
      setLeaving((current) => {
        const next = new Map(current);
        for (const { todo } of dead) if (next.get(todo.id) === leaving.get(todo.id)) next.delete(todo.id);
        return next;
      });
      return;
    }
    for (const { todo } of leaving.values()) {
      if (cached.has(todo.id) || leaveTimers.current.has(todo.id)) continue;
      const timer = setTimeout(() => {
        leaveTimers.current.delete(todo.id);
        setLeaving((current) => withoutLeft(current, todo.id));
      }, leaveDuration());
      leaveTimers.current.set(todo.id, timer);
    }
  }, [todos, leaving, revertedAt]);

  useEffect(() => {
    const timers = leaveTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  // What holds focus in the list area (EXPERIENCE Hand-off order).
  const focused = useRef<Focused>(null);

  function focusedOf(node: EventTarget | null): Focused {
    const id = rowIdOf(node);
    if (id !== null) return { kind: 'row', id };
    if (node === listRef.current) return { kind: 'list' };
    if (node === emptyRef.current) return { kind: 'empty' };
    if (node instanceof Node && panelRef.current?.contains(node)) return { kind: 'panel' };
    return null;
  }

  function trackFocus(event: FocusEvent<HTMLDivElement>) {
    focused.current = focusedOf(event.target);
  }

  function trackBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget !== null) {
      // Focus moved to another element: inside the area, trackFocus records it next.
      if (!areaRef.current?.contains(event.relatedTarget as Node)) focused.current = null;
      return;
    }
    // No next element: the window lost focus (the element stays active), focus went
    // to nothing (the element stays connected), or the element was removed (keep it).
    const left = event.target;
    const was = focusedOf(left);
    queueMicrotask(() => {
      if (left.isConnected && document.activeElement !== left && sameFocused(focused.current, was)) focused.current = null;
    });
  }

  // Set by the focus move below when it lands on the Todo list or the Empty panel,
  // and read by the Loading status in the same commit (Recovery line).
  const movedToList = useRef(false);

  /** Moves focus to `target`, noting a move to the Todo list or the Empty panel. */
  function moveFocusTo(target: HTMLElement) {
    movedToList.current = target === listRef.current || target === emptyRef.current;
    if (target === focusTargets.heading.current) target.focus({ preventScroll: true });
    else target.focus();
  }

  /**
   * An emptied list's target: the Empty panel, because no activation decides
   * between field and heading; the Todo list while only Leaving rows remain;
   * before the first load (no Empty panel yet) the Page heading, which has the
   * Empty panel's properties: not actionable, and no phone keyboard.
   */
  function fallbackTarget(): HTMLElement | null {
    return emptyRef.current ?? listRef.current ?? focusTargets.heading.current;
  }

  // Focus off a removed element (EXPERIENCE Focus management): when the tracked
  // element is gone and focus fell to <body>, a row's goes to the check of the row
  // now at its place, else the one before, else the emptied list's target; the
  // Todo list's to that target; the Empty panel's (replaced by rows) to the Todo
  // list; the List error panel's (replaced by a refetch) to the Todo list, else the
  // Empty panel. Runs every commit, before the announce and the Loading status below.
  // `previousIds` is the last commit's operable rows, in the order they render.
  const previousIds = useRef<string[]>([]);
  useLayoutEffect(() => {
    movedToList.current = false;
    // Focus targets skip Leaving rows.
    const ids = todos.map((todo) => todo.id).filter((id) => !leavingIds.has(id));
    const before = previousIds.current;
    previousIds.current = ids;
    const tracked = focused.current;
    if (tracked === null) return;
    const gone =
      tracked.kind === 'row'
        ? !ids.includes(tracked.id)
        : (tracked.kind === 'list' ? listRef : tracked.kind === 'empty' ? emptyRef : panelRef).current === null;
    if (!gone) return;
    focused.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    let target: HTMLElement | null;
    if (tracked.kind === 'row') {
      // Its place among the rows that survived: those before it in the previous commit.
      target = checkAtPlaceOf(listRef.current, tracked.id, before, ids) ?? fallbackTarget();
    } else if (tracked.kind === 'list') {
      target = fallbackTarget();
    } else {
      target = listRef.current ?? fallbackTarget();
    }
    if (target) moveFocusTo(target);
  });

  /**
   * A card moves focus off its own row by the same rule, before the row goes: the
   * rows as they render now, without it. Read when a handler runs or a call settles,
   * when `previousIds` holds the rows the DOM shows.
   */
  function focusFor(id: string): CardFocus {
    return {
      nextCheck: () => {
        const before = previousIds.current;
        return checkAtPlaceOf(listRef.current, id, before, before.filter((other) => other !== id));
      },
      targets: focusTargets,
    };
  }

  // A row in edit mode that a refetch removed (EXPERIENCE State Patterns): the form
  // closes with its draft, and the loss is announced, unless a helper revert removed
  // it (a failed create records its revert in the same step as the removal).
  // Recorded only when the list or the editing row changes, so a revert recorded in
  // the commit that removes the row always reads as changed.
  const watched = useRef<{ id: string; description: string; revertedAt: number | undefined } | null>(null);
  useLayoutEffect(() => {
    if (editingId === null) {
      watched.current = null;
      return;
    }
    const todo = todos.find((t) => t.id === editingId);
    const reverted = revertedAt.get(editingId);
    if (todo) {
      watched.current = { id: editingId, description: todo.description, revertedAt: reverted };
      return;
    }
    const last = watched.current;
    watched.current = null;
    setOpen((current) => (current?.id === editingId && current.mode === 'edit' ? null : current));
    drafts.current.delete(editingId);
    if (last?.id === editingId && last.revertedAt === reverted) announceDeletedElsewhere({ id: last.id, description: last.description });
    // Only a change to the list or the editing row is a removal to judge.
  }, [todos, editingId]);

  // A row in the Delete confirm that left the cache (a refetch, or a failed add): the
  // confirm closes silently (EXPERIENCE State Patterns › Confirm open, todo vanishes).
  useLayoutEffect(() => {
    if (confirmingId === null || todos.some((t) => t.id === confirmingId)) return;
    setOpen((current) => (current?.id === confirmingId && current.mode === 'confirm' ? null : current));
  }, [todos, confirmingId]);

  // The one Loading status (AD-14): its line is picked in the same commit as, and
  // after, any focus move above, so the recovery line knows whether focus went to the list.
  const [status] = useState(() =>
    createLoadingStatus({
      write: (text) => {
        if (statusRef.current) statusRef.current.textContent = text;
      },
      read: () => statusRef.current?.textContent ?? '',
    }),
  );
  useLayoutEffect(() => {
    status.update(state, errorLine, movedToList.current);
    movedToList.current = false;
  });
  useLayoutEffect(() => () => status.reset(), [status]);

  // Try again (EXPERIENCE Hand-off order): focus moves to the add field first, or to the
  // heading after a touch so the phone keyboard stays closed; then the panel goes.
  const tryAgainTap = useTapOrigin();

  function handleTryAgain(event: MouseEvent<HTMLButtonElement>) {
    if (tryAgainTap.tapped(event)) focusTargets.heading.current?.focus({ preventScroll: true });
    else focusTargets.addField.current?.focus();
    flushSync(retry);
  }

  return (
    <div ref={areaRef} className={styles.area} onFocus={trackFocus} onBlur={trackBlur}>
      <p ref={statusRef} role="status" aria-live="polite" className="visually-hidden" data-loading-status="" />
      {rows.length > 0 && (
        <ul ref={listRef} role="list" aria-label="Todos" tabIndex={-1} className={styles.list}>
          {rows.map((row, index) =>
            row.leaving ? (
              <TodoCard key={row.key} todo={row.todo} leaving />
            ) : (
              <TodoCard
                key={row.key}
                todo={row.todo}
                enter={enter}
                edit={editingFor(row.todo.id)}
                confirm={confirmFor(row.todo, index)}
                focus={focusFor(row.todo.id)}
              />
            ),
          )}
        </ul>
      )}
      {state === 'loading' && (
        <ul aria-busy="true" className={styles.skeletons}>
          {SKELETONS.map((n) => (
            <li key={n} aria-hidden="true" className={styles.skeleton}>
              <span className={styles.skeletonCircle} />
              <span className={styles.skeletonBar} />
            </li>
          ))}
        </ul>
      )}
      {state === 'error' && (
        <div ref={panelRef} className={styles.errorPanel}>
          <p className={styles.errorLine}>{errorLine}</p>
          <button
            type="button"
            className={styles.tryAgain}
            onPointerDown={tryAgainTap.onPointerDown}
            onClick={handleTryAgain}
          >
            {messages.tryAgain}
          </button>
        </div>
      )}
      {state === 'empty' && rows.length === 0 && (
        <p ref={emptyRef} tabIndex={-1} className={styles.empty}>
          {messages.emptyList}
        </p>
      )}
    </div>
  );
}
