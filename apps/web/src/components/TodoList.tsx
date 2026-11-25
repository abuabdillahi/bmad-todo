import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import type { Todo } from '@todo/contract';
import { useAnnounceDeletedElsewhere, useDeleteTodo, useListState, useReportRenderedIds, useTodosStore } from '../todos/hooks.ts';
import { isLive, mergeRows, withoutLeft, type LeavingEntry } from './leaving-rows.ts';
import { TodoCard, type CardConfirm, type CardEditing } from './TodoCard.tsx';
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
 * The list area: the one observer of `['todos']` (AD-11). It reports the ids
 * it renders to the add form (Add landed after all), owns the one open row (in
 * edit mode or the Delete confirm) and the per-todo failed drafts (EXPERIENCE
 * Component Patterns › Edit form, Todo card), keeps each user-deleted row as an
 * inert Leaving copy for its leave motion (AD-11), announces a row in edit mode
 * that a refetch removed (AD-14), and moves focus off a focused row that
 * something other than a handler removed (EXPERIENCE Focus management). Epic 2
 * renders the loading, error and empty states from `state`.
 */
export function TodoList() {
  const { state, todos } = useListState();
  const { revertedAt } = useTodosStore();
  const announceDeletedElsewhere = useAnnounceDeletedElsewhere();
  const deleteTodo = useDeleteTodo();
  const loaded = state === 'populated' || state === 'empty';
  const listRef = useRef<HTMLUListElement>(null);

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

  // The row holding focus, tracked because once a row is detached `document.activeElement` is already `<body>`.
  const focusedId = useRef<string | null>(null);

  function handleFocus(event: FocusEvent<HTMLUListElement>) {
    focusedId.current = rowIdOf(event.target);
  }

  function handleBlur(event: FocusEvent<HTMLUListElement>) {
    if (event.relatedTarget !== null) {
      // Focus moved to another element: inside the list, handleFocus records it next.
      if (!listRef.current?.contains(event.relatedTarget as Node)) focusedId.current = null;
      return;
    }
    // No next element: the window lost focus (the element stays active), focus went
    // to nothing (the element stays connected), or the element was removed (keep it).
    const left = event.target;
    queueMicrotask(() => {
      if (left.isConnected && document.activeElement !== left && focusedId.current === rowIdOf(left)) focusedId.current = null;
    });
  }

  // Focus off a removed row (EXPERIENCE Focus management): when the tracked row is gone
  // and focus fell to <body>, it goes to the check of the row now at its place, else the
  // one before, else the list. This runs before the announce below.
  const previousIds = useRef<string[]>([]);
  useLayoutEffect(() => {
    // Focus targets skip Leaving rows.
    const ids = todos.map((todo) => todo.id).filter((id) => !leavingIds.has(id));
    const before = previousIds.current;
    previousIds.current = ids;
    const tracked = focusedId.current;
    if (tracked === null || ids.includes(tracked)) return;
    focusedId.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const list = listRef.current;
    if (!list) return;
    // Its place among the rows that survived: those before it in the previous commit.
    const kept = new Set(ids);
    const at = before.slice(0, Math.max(0, before.indexOf(tracked))).filter((id) => kept.has(id)).length;
    const targetId = ids.length === 0 ? undefined : ids[Math.min(at, ids.length - 1)];
    const row = [...list.children].find((item) => item.getAttribute('data-todo-id') === targetId && !item.hasAttribute('data-leaving'));
    (row?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? list).focus();
  }, [todos]);

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
    if (last?.id === editingId && last.revertedAt === reverted) announceDeletedElsewhere(last.description);
    // Only a change to the list or the editing row is a removal to judge.
  }, [todos, editingId]);

  // A row in the Delete confirm that left the cache (a refetch, or a failed add): the
  // confirm closes silently (EXPERIENCE State Patterns › Confirm open, todo vanishes).
  useLayoutEffect(() => {
    if (confirmingId === null || todos.some((t) => t.id === confirmingId)) return;
    setOpen((current) => (current?.id === confirmingId && current.mode === 'confirm' ? null : current));
  }, [todos, confirmingId]);

  return (
    <ul
      ref={listRef}
      role="list"
      aria-label="Todos"
      tabIndex={-1}
      className={styles.list}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {rows.map((row, index) =>
        row.leaving ? (
          <TodoCard key={row.key} todo={row.todo} leaving />
        ) : (
          <TodoCard key={row.key} todo={row.todo} enter={enter} edit={editingFor(row.todo.id)} confirm={confirmFor(row.todo, index)} />
        ),
      )}
    </ul>
  );
}
