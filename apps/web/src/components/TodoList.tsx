import { useListState } from '../todos/hooks.ts';
import { TodoCard } from './TodoCard.tsx';
import styles from './TodoList.module.css';

/**
 * The list area: the one observer of `['todos']` (AD-11). Epic 2 renders the
 * loading, error and empty states from `state`.
 */
export function TodoList() {
  const { todos } = useListState();

  return (
    <ul role="list" aria-label="Todos" tabIndex={-1} className={styles.list}>
      {todos.map((todo) => (
        <TodoCard key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
