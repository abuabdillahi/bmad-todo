import { useEffect, useId, useReducer, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import type { Todo } from '@todo/contract';
import { useEditDescription, useRevertedAt, useSetCompleted } from '../todos/hooks.ts';
import type { AnnouncerFocusTargets } from './Announcer.tsx';
import { EditForm } from './EditForm.tsx';
import { useTapOrigin } from './tap-origin.ts';
import { isComposingKey } from './TextField.tsx';
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

/** What the list area gives each card for the Delete confirm: it owns the one open row, and the Leaving rows. */
export interface CardConfirm {
  /** This row is in the Delete confirm. */
  readonly confirming: boolean;
  /** Puts this row in the Delete confirm, closing any other row's edit or confirm silently. */
  readonly open: () => void;
  /** Closes the Delete confirm. */
  readonly close: () => void;
  /** Deletes the todo: the row turns into its Leaving copy, and the helper sends the delete. */
  readonly remove: () => void;
}

const NOT_CONFIRMING: CardConfirm = {
  confirming: false,
  open: () => {},
  close: () => {},
  remove: () => {},
};

/** What the list area gives each card to move focus off its row: it owns the rows' order. */
export interface CardFocus {
  /**
   * The Completion check of the operable row after this one, else of the one
   * before it, else null (the row is the only one). Leaving copies are skipped.
   */
  readonly nextCheck: () => HTMLInputElement | null;
  /** The add field and the Page heading. */
  readonly targets: AnnouncerFocusTargets;
}

const NO_FOCUS: CardFocus = {
  nextCheck: () => null,
  targets: { addField: { current: null }, heading: { current: null } },
};

export interface TodoCardProps {
  todo: Todo;
  /** Play the enter motion when this card mounts (read once, at mount). */
  enter?: boolean;
  /** Edit mode, owned by the list area. */
  edit?: CardEditing;
  /** The Delete confirm, owned by the list area. */
  confirm?: CardConfirm;
  /** Where focus goes off this row, owned by the list area. */
  focus?: CardFocus;
  /** A Leaving copy: inert and hidden from assistive tech, playing the leave motion only. */
  leaving?: boolean;
}

/**
 * One todo: its Completion check, its text, when done the Done chip, and its
 * Edit and Delete buttons; in edit mode, the Edit form in place of the text
 * and the buttons; in the Delete confirm, "Delete this todo?", Confirm delete
 * and Cancel in place of the buttons (DESIGN.md Components › Todo card). The
 * check is controlled by the cached `completed` (AD-11) and changes it only
 * through the helper (AD-13), as a save does. The text renders only through
 * React's escaping (AD-19).
 */
export function TodoCard({
  todo,
  enter = false,
  edit = NOT_EDITING,
  confirm = NOT_CONFIRMING,
  focus = NO_FOCUS,
  leaving = false,
}: TodoCardProps) {
  const [entering] = useState(enter && !leaving);
  const textId = useId();
  const promptId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  // A tapped Confirm delete on the last row sends focus to the heading.
  const tapOrigin = useTapOrigin();
  // Counts this card's changed saves, so only the latest one keeps a failed draft.
  const latestSave = useRef(0);
  const setCompleted = useSetCompleted();
  const editDescription = useEditDescription();
  const flagged = useRevertFlag(useRevertedAt(todo.id));
  const { editing } = edit;
  const confirming = confirm.confirming && !editing;
  // The Edit form's opening text, set in the Edit handler, never during render (StrictMode).
  const [initial, setInitial] = useState('');
  // The text view fades in only when it comes back from edit mode, never on first load;
  // Edit and Delete also fade in when they come back from the Delete confirm.
  const [leftEdit, setLeftEdit] = useState(false);
  if (editing && !leftEdit) setLeftEdit(true);
  const [leftSwap, setLeftSwap] = useState(false);
  if ((editing || confirming) && !leftSwap) setLeftSwap(true);

  /**
   * Deleted elsewhere: the row goes on the settle-time refetch, so focus inside it
   * moves now, to the next row's check, else the previous row's, else the list.
   * The list is only the interim target: when the refetch empties it, the list
   * area moves focus on to the Empty panel as the `<ul>` goes.
   */
  function moveFocusOffRow() {
    const item = itemRef.current;
    if (!item?.contains(document.activeElement)) return;
    const target = focus.nextCheck() ?? item.closest('ul');
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

  /** Swaps Edit and Delete for the Delete confirm, then focuses Cancel in the same task. Nothing is sent. */
  function openConfirm() {
    flushSync(() => confirm.open());
    cancelButtonRef.current?.focus();
  }

  /** Closes the Delete confirm, then focuses Delete in the same task. */
  function closeConfirm() {
    flushSync(() => confirm.close());
    deleteButtonRef.current?.focus();
  }

  function handleConfirmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    // Escape ends an IME composition first; it never cancels the confirm then.
    if (isComposingKey(event)) return;
    event.preventDefault();
    closeConfirm();
  }

  /**
   * The after-delete rule (EXPERIENCE Focus management), then the delete: focus
   * moves first, to the next operable row's check, else the previous one's,
   * else the add field, or the heading after a tap, so the phone keyboard stays
   * closed. Only then does the row turn into its inert Leaving copy.
   */
  function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
    const touch = tapOrigin.tapped(event);
    const check = focus.nextCheck();
    if (check) check.focus();
    else if (touch) focus.targets.heading.current?.focus({ preventScroll: true });
    else focus.targets.addField.current?.focus();
    flushSync(() => confirm.remove());
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
  const actionsBack = leftSwap ? ` ${styles.swapIn}` : '';
  const itemClass = [styles.item, entering && styles.enter, leaving && styles.leaving].filter(Boolean).join(' ');

  return (
    <li
      ref={itemRef}
      className={itemClass}
      data-todo-id={todo.id}
      data-leaving={leaving ? '' : undefined}
      inert={leaving}
      aria-hidden={leaving ? 'true' : undefined}
    >
      <div className={styles.body}>
        <div className={cardClass} onPointerDown={tapOrigin.onPointerDown}>
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
          {/* Keyed, so each swap remounts the actions and only the incoming content fades in. */}
          {confirming ? (
            <div key="confirm" className={`${styles.actions} ${styles.confirming} ${styles.swapIn}`}>
              <div role="group" aria-labelledby={`${promptId} ${textId}`} className={styles.confirm} onKeyDown={handleConfirmKeyDown}>
                <span id={promptId} className={todo.completed ? `${styles.prompt} ${styles.promptDone}` : styles.prompt}>
                  Delete this todo?
                </span>
                <span className={styles.confirmButtons}>
                  <button
                    type="button"
                    className={`${buttons.button} ${buttons.dangerStrong}`}
                    aria-label={`Delete “${todo.description}”`}
                    onClick={confirmDelete}
                  >
                    Delete
                  </button>
                  <button ref={cancelButtonRef} type="button" className={`${buttons.button} ${buttons.cancel}`} onClick={closeConfirm}>
                    Cancel
                  </button>
                </span>
              </div>
            </div>
          ) : (
            !editing && (
              <div key="buttons" className={`${styles.actions}${actionsBack}`}>
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
                <button
                  ref={deleteButtonRef}
                  type="button"
                  className={`${buttons.button} ${todo.completed ? buttons.done : buttons.danger}`}
                  aria-label={`Delete “${todo.description}”`}
                  onClick={openConfirm}
                >
                  Delete
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </li>
  );
}
