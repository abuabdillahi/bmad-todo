import type { Todo } from '@todo/contract';
import styles from './TodoCard.module.css';

export interface TodoCardProps {
  todo: Todo;
}

/** One todo. Its text renders only through React's escaping (AD-19). */
export function TodoCard({ todo }: TodoCardProps) {
  return (
    <li className={styles.item}>
      <div className={styles.card}>
        <span className={styles.text}>{todo.description}</span>
      </div>
    </li>
  );
}
