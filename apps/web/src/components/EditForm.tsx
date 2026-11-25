import { useLayoutEffect, type FormEvent, type KeyboardEvent } from 'react';
import { messages } from '../todos/messages.ts';
import { TextFieldBox, TextFieldNotes, useTextField } from './TextField.tsx';
import buttons from './CardButton.module.css';
import styles from './EditForm.module.css';

export interface EditFormProps {
  /** The text the field opens with: the saved text, or the kept failed draft. Read once, at mount. */
  initial: string;
  /** A valid submit: the prepared text (AD-8). */
  onSave: (description: string) => void;
  /** Cancel, or Escape from anywhere in the form. */
  onCancel: () => void;
}

/**
 * The Edit form (DESIGN.md Components › Edit form, EXPERIENCE Component
 * Patterns › Edit form): the Text field (edit), named "Edit description", then
 * Save and Cancel. It takes focus with all text selected as it mounts, so focus
 * lands in the same task as the row's swap (EXPERIENCE Hand-off order).
 */
export function EditForm({ initial, onSave, onCancel }: EditFormProps) {
  const field = useTextField({ hint: messages.inline.hintEdit, initial });

  useLayoutEffect(() => {
    const el = field.ref.current;
    if (!el) return;
    el.focus();
    el.select();
    // Mount only: the field opens focused and selected once.
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = field.submitValue();
    if (description !== null) onSave(description);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Escape') return;
    // Escape ends an IME composition first; it never cancels the edit then.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    onCancel();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <label className="visually-hidden" htmlFor={field.id}>
        Edit description
      </label>
      <TextFieldBox field={field} contentClassName={styles.swapIn} />
      <TextFieldNotes field={field} />
      <div className={`${styles.actions} ${styles.swapIn}`}>
        <button type="submit" className={`${buttons.button} ${buttons.primary}`}>
          Save
        </button>
        <button type="button" className={`${buttons.button} ${buttons.cancel}`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
