import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import { useAnnounceDeletedElsewhere, useListState, useReportRenderedIds, useTodosStore } from '../todos/hooks.ts';
import { TodoCard, type CardEditing } from './TodoCard.tsx';
import styles from './TodoList.module.css';

/** The id of the row holding `node`, or null outside any row. */
function rowIdOf(node: EventTarget | null): string | null {
  return node instanceof Element ? (node.closest('li[data-todo-id]')?.getAttribute('data-todo-id') ?? null) : null;
}

/**
 * The list area: the one observer of `['todos']` (AD-11). It reports the ids
 * it renders to the add form (Add landed after all), owns which row is in edit
 * mode and the per-todo failed drafts (EXPERIENCE Component Patterns › Edit
 * form), announces a row in edit mode that a refetch removed (AD-14), and moves
 * focus off a focused row that something other than a handler removed
 * (EXPERIENCE Focus management). Epic 2 renders the loading, error and empty
 * states from `state`.
 */
export function TodoList() {
  const { state, todos } = useListState();
  const { revertedAt } = useTodosStore();
  const announceDeletedElsewhere = useAnnounceDeletedElsewhere();
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

  // Edit mode: at most one row at a time. Opening another row replaces the id,
  // so the open form unmounts silently with its draft.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Failed drafts per todo, until the page reloads. Read through stable closures,
  // so a save that settles after its card unmounted still keeps its draft.
  const drafts = useRef(new Map<string, string>());

  function editingFor(id: string): CardEditing {
    return {
      editing: id === editingId,
      open: () => setEditingId(id),
      close: () => setEditingId((current) => (current === id ? null : current)),
      takeDraft: () => {
        const draft = drafts.current.get(id);
        drafts.current.delete(id);
        return draft;
      },
      keepDraft: (text) => drafts.current.set(id, text),
    };
  }

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
    const ids = todos.map((todo) => todo.id);
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
    const row = [...list.children].find((item) => item.getAttribute('data-todo-id') === targetId);
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
    setEditingId(null);
    drafts.current.delete(editingId);
    if (last?.id === editingId && last.revertedAt === reverted) announceDeletedElsewhere(last.description);
    // Only a change to the list or the editing row is a removal to judge.
  }, [todos, editingId]);

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
      {todos.map((todo) => (
        <TodoCard key={todo.id} todo={todo} enter={enter} edit={editingFor(todo.id)} />
      ))}
    </ul>
  );
}
