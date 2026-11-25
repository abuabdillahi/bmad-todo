import { useState } from 'react';
import type { Todo } from '@todo/contract';
import styles from './TodoCard.module.css';

export interface TodoCardProps {
  todo: Todo;
  /** Play the enter motion when this card mounts (read once, at mount). */
  enter?: boolean;
}

/** One todo. Its text renders only through React's escaping (AD-19). */
export function TodoCard({ todo, enter = false }: TodoCardProps) {
  const [entering] = useState(enter);
  return (
    <li className={entering ? `${styles.item} ${styles.enter}` : styles.item}>
      <div className={styles.body}>
        <div className={styles.card}>
          <span className={styles.text}>{todo.description}</span>
        </div>
      </div>
    </li>
  );
}
