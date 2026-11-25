import { useEffect, useId, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { flushSync } from 'react-dom';
import type { Todo } from '@todo/contract';
import { useEditDescription, useRevertedAt, useSetCompleted } from '../todos/hooks.ts';
import { EditForm } from './EditForm.tsx';
import buttons from './CardButton.module.css';
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

/** What the list area gives each card for edit mode: it owns which row edits, and the drafts. */
export interface CardEditing {
  /** This row is in edit mode. */
  readonly editing: boolean;
  /** Puts this row in edit mode, closing any other row's edit silently. */
  readonly open: () => void;
  /** Leaves edit mode. */
  readonly close: () => void;
  /** This todo's kept failed draft, if any, removed as it is read: only the next Edit uses it. */
  readonly takeDraft: () => string | undefined;
  /** Keeps a failed save's text for this todo's next Edit, until the page reloads. */
  readonly keepDraft: (text: string) => void;
}

const NOT_EDITING: CardEditing = {
  editing: false,
  open: () => {},
  close: () => {},
  takeDraft: () => undefined,
  keepDraft: () => {},
};

export interface TodoCardProps {
  todo: Todo;
  /** Play the enter motion when this card mounts (read once, at mount). */
  enter?: boolean;
  /** Edit mode, owned by the list area. */
  edit?: CardEditing;
}

/**
 * One todo: its Completion check, its text, when done the Done chip, and its
 * Edit button; in edit mode, the Edit form in place of the text and Edit
 * (DESIGN.md Components › Todo card). The check is controlled by the cached
 * `completed` (AD-11) and changes it only through the helper (AD-13), as a save
 * does. The text renders only through React's escaping (AD-19).
 */
export function TodoCard({ todo, enter = false, edit = NOT_EDITING }: TodoCardProps) {
  const [entering] = useState(enter);
  const textId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Counts this card's changed saves, so only the latest one keeps a failed draft.
  const latestSave = useRef(0);
  const setCompleted = useSetCompleted();
  const editDescription = useEditDescription();
  const flagged = useRevertFlag(useRevertedAt(todo.id));
  const { editing } = edit;
  // The Edit form's opening text, set in the Edit handler, never during render (StrictMode).
  const [initial, setInitial] = useState('');
  // The text view fades in only when it comes back from edit mode, never on first load.
  const [leftEdit, setLeftEdit] = useState(false);
  if (editing && !leftEdit) setLeftEdit(true);

  /**
   * Deleted elsewhere: the row goes on the settle-time refetch, so focus inside it
   * moves now, to the next row's check, else the previous row's, else the list.
   */
  function moveFocusOffRow() {
    const item = itemRef.current;
    if (!item?.contains(document.activeElement)) return;
    const target = checkOf(item.nextElementSibling) ?? checkOf(item.previousElementSibling) ?? item.closest('ul');
    target?.focus();
  }

  async function toggle(event: ChangeEvent<HTMLInputElement>) {
    const outcome = await setCompleted(todo, event.currentTarget.checked);
    if (outcome.status === 'failed' && outcome.failure.kind === 'not-found') moveFocusOffRow();
  }

  /** Swaps the row to the Edit form; the form focuses its field as it mounts, in this task. */
  function openEdit() {
    const text = edit.takeDraft() ?? todo.description;
    flushSync(() => {
      setInitial(text);
      edit.open();
    });
  }

  /** Swaps back, then focuses Edit in the same task (EXPERIENCE Hand-off order). */
  function closeEdit() {
    flushSync(() => edit.close());
    editButtonRef.current?.focus();
  }

  async function save(text: string) {
    closeEdit();
    // Unchanged text sends nothing: the prepared draft is compared with the cached description.
    if (text === todo.description) return;
    const thisSave = ++latestSave.current;
    const outcome = await editDescription(todo, text);
    if (outcome.status !== 'failed') return;
    // Not found: the row is going, and its draft with it.
    if (outcome.failure.kind === 'not-found') {
      moveFocusOffRow();
      return;
    }
    // The next Edit opens with the failed draft (WCAG 3.3.7), unless a later save superseded it.
    if (thisSave === latestSave.current) edit.keepDraft(text);
  }

  // Edit mode always takes the active treatment, even for a done todo (DESIGN.md Todo card › Edit).
  const cardClass = [styles.card, editing && styles.editing, todo.completed && !editing && styles.done, flagged && styles.flagged]
    .filter(Boolean)
    .join(' ');
  const swapBack = leftEdit ? ` ${styles.swapIn}` : '';

  return (
    <li ref={itemRef} className={entering ? `${styles.item} ${styles.enter}` : styles.item} data-todo-id={todo.id}>
      <div className={styles.body}>
        <div className={cardClass}>
          <div className={styles.main}>
            <span className={styles.check}>
              {/* In edit mode the text element is gone, so the check is named by the saved text directly. */}
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={toggle}
                aria-labelledby={editing ? undefined : textId}
                aria-label={editing ? todo.description : undefined}
              />
              <svg className={styles.circle} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
                <circle cx="13" cy="13" r="12" />
                <path d="M3.5 8.4l3 3 6-6.8" transform="translate(5 5)" />
              </svg>
            </span>
            {editing ? (
              <EditForm initial={initial} onSave={(text) => void save(text)} onCancel={closeEdit} />
            ) : (
              <div className={`${styles.content}${swapBack}`}>
                <span id={textId}>{todo.description}</span>
                {todo.completed && (
                  <span className={styles.chip} aria-hidden="true">
                    Done
                  </span>
                )}
              </div>
            )}
          </div>
          {!editing && (
            <div className={`${styles.actions}${swapBack}`}>
              {/* The name starts with the visible label (WCAG 2.5.3) and quotes the full text, never cut, so names are unique whenever the texts differ. */}
              <button
                ref={editButtonRef}
                type="button"
                className={`${buttons.button} ${todo.completed ? buttons.done : buttons.soft}`}
                aria-label={`Edit “${todo.description}”`}
                onClick={openEdit}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
