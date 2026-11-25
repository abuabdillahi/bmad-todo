import { useEffect, useRef } from 'react';
import { useListState, useReportRenderedIds } from '../todos/hooks.ts';
import { TodoCard } from './TodoCard.tsx';
import styles from './TodoList.module.css';

/**
 * The list area: the one observer of `['todos']` (AD-11). It reports the ids
 * it renders to the add form (Add landed after all). Epic 2 renders the
 * loading, error and empty states from `state`.
 */
export function TodoList() {
  const { state, todos } = useListState();
  const loaded = state === 'populated' || state === 'empty';

  // A card plays the enter motion only if it mounts while the list is not
  // loaded (only optimistic adds are there then) or once the list was already
  // loaded in the previous commit: cards arriving with the first load don't.
  const loadedBefore = useRef(loaded);
  useEffect(() => {
    loadedBefore.current = loaded;
  });
  const enter = !loaded || loadedBefore.current;

  useReportRenderedIds(todos);

  return (
    <ul role="list" aria-label="Todos" tabIndex={-1} className={styles.list}>
      {todos.map((todo) => (
        <TodoCard key={todo.id} todo={todo} enter={enter} />
      ))}
    </ul>
  );
}
