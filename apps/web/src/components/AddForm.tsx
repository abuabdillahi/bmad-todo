import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useAddTodo } from '../todos/hooks.ts';
import styles from './AddForm.module.css';

const MAX_LENGTH = 200;

/** Unicode code points, the unit the API's limit uses (AD-8). */
function countCodePoints(text: string): number {
  return [...text].length;
}

/**
 * Grows the textarea with its content where CSS `field-sizing: content` is
 * unsupported (DESIGN.md Components › Text field).
 */
function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string): void {
  const supported = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

  useLayoutEffect(() => {
    const el = ref.current;
    if (supported || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, supported, value]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (supported || !el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, supported]);
}

export function AddForm() {
  const addTodo = useAddTodo();
  const [value, setValue] = useState('');
  const pending = useRef<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const counterId = useId();
  const hintId = useId();

  useAutoGrow(fieldRef, value);

  async function submit() {
    const description = value.trim();
    // Story 4 replaces this with the AD-8 client check and its inline message.
    if (description === '') return;
    // A second press while the same text is on its way would create a duplicate.
    if (pending.current === description) return;

    pending.current = description;
    const outcome = await addTodo(description);
    pending.current = null;

    // On failure the text stays and nothing is added (epic Decision 2026-11-24).
    // On success the field clears, unless the user has typed something new since,
    // and focus is in the field even when Add was pressed (EXPERIENCE Focus management).
    if (outcome === 'ok') {
      setValue((current) => (current === value ? '' : current));
      fieldRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return;
    // Enter never inserts a newline, and doesn't submit while an IME composition is open.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (event.shiftKey) return;
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={fieldId}>
        New todo
      </label>
      <div className={styles.row}>
        <div className={styles.field}>
          <textarea
            ref={fieldRef}
            id={fieldId}
            className={styles.textarea}
            value={value}
            rows={1}
            enterKeyHint="done"
            aria-describedby={`${counterId} ${hintId}`}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className={styles.footer}>
            <span id={counterId} className={styles.counter}>
              {countCodePoints(value)}/{MAX_LENGTH}
            </span>
          </div>
        </div>
        <button type="submit" className={styles.add}>
          Add
        </button>
      </div>
      <span id={hintId} className="visually-hidden">
        Press Enter to add.
      </span>
    </form>
  );
}
