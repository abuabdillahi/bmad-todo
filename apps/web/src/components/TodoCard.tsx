import { useEffect, useId, useReducer, useRef, useState, type ChangeEvent } from 'react';
import type { Todo } from '@todo/contract';
import { useRevertedAt, useSetCompleted } from '../todos/hooks.ts';
import styles from './TodoCard.module.css';

/** How long a reverted card stays flagged: `--motion-duration-revert`, mirrored. */
export const REVERT_FLAG_MS = 1200;

/**
 * True while less than `REVERT_FLAG_MS` has passed since `revertedAt`
 * (EXPERIENCE State Patterns › Reverted): a card that mounts inside that window
 * is flagged for the time that remains. A timer re-renders the card once the
 * window closes; it is cleared on unmount or on a new record.
 */
function useRevertFlag(revertedAt: number | undefined): boolean {
  const [, expire] = useReducer((count: number) => count + 1, 0);
  const flagged = revertedAt !== undefined && Date.now() - revertedAt < REVERT_FLAG_MS;

  useEffect(() => {
    if (revertedAt === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remaining = () => revertedAt + REVERT_FLAG_MS - Date.now();
    // A timer may fire a little early: check again, and re-arm for what is left.
    const check = () => {
      const left = remaining();
      if (left > 0) timer = setTimeout(check, left);
      else expire();
    };
    const left = remaining();
    if (left > 0) timer = setTimeout(check, left);
    else if (flagged) expire();
    return () => clearTimeout(timer);
  }, [revertedAt, flagged]);

  return flagged;
}

/** The Completion check of the row `item`, if there is one. */
function checkOf(item: Element | null): HTMLInputElement | null {
  return item?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
}

export interface TodoCardProps {
  todo: Todo;
  /** Play the enter motion when this card mounts (read once, at mount). */
  enter?: boolean;
}

/**
 * One todo: its Completion check, its text and, when done, the Done chip
 * (DESIGN.md Components › Todo card). The check is controlled by the cached
 * `completed` (AD-11) and changes it only through the helper (AD-13). The text
 * renders only through React's escaping (AD-19).
 */
export function TodoCard({ todo, enter = false }: TodoCardProps) {
  const [entering] = useState(enter);
  const textId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const setCompleted = useSetCompleted();
  const flagged = useRevertFlag(useRevertedAt(todo.id));

  async function toggle(event: ChangeEvent<HTMLInputElement>) {
    const outcome = await setCompleted(todo, event.currentTarget.checked);
    if (outcome.status !== 'failed' || outcome.failure.kind !== 'not-found') return;
    // Deleted elsewhere: the row goes on the settle-time refetch, so focus inside it
    // moves now, to the next row's check, else the previous row's, else the list.
    const item = itemRef.current;
    if (!item?.contains(document.activeElement)) return;
    const target = checkOf(item.nextElementSibling) ?? checkOf(item.previousElementSibling) ?? item.closest('ul');
    target?.focus();
  }

  const cardClass = [styles.card, todo.completed && styles.done, flagged && styles.flagged].filter(Boolean).join(' ');

  return (
    <li ref={itemRef} className={entering ? `${styles.item} ${styles.enter}` : styles.item}>
      <div className={styles.body}>
        <div className={cardClass}>
          <span className={styles.check}>
            <input type="checkbox" checked={todo.completed} onChange={toggle} aria-labelledby={textId} />
            <svg className={styles.circle} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
              <circle cx="13" cy="13" r="12" />
              <path d="M3.5 8.4l3 3 6-6.8" transform="translate(5 5)" />
            </svg>
          </span>
          <div className={styles.content}>
            <span id={textId}>{todo.description}</span>
            {todo.completed && (
              <span className={styles.chip} aria-hidden="true">
                Done
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
