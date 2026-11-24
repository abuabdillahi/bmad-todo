import { useTodos } from '../todos/hooks.ts';
import { TodoCard } from './TodoCard.tsx';
import styles from './TodoList.module.css';

/** The list area: the one observer of `['todos']` (AD-11). */
export function TodoList() {
  const todos = useTodos();

  return (
    <ul role="list" aria-label="Todos" tabIndex={-1} className={styles.list}>
      {todos.map((todo) => (
        <TodoCard key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
