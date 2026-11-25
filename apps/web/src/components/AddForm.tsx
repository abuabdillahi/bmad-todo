import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
  type RefObject,
} from 'react';
import { checkDescription, DESCRIPTION_MAX_LENGTH } from '@todo/contract/description';
import { useAddTodo, useLandedAfterAll } from '../todos/hooks.ts';
import { messages } from '../todos/messages.ts';
import { countCodePoints, prepareDescription, replaceForbidden } from './description-input.ts';
import styles from './AddForm.module.css';

/** How long the crossing message stays in the Field status (EXPERIENCE Field status). */
const CROSSING_CLEAR_MS = 5000;

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

/**
 * The add field's one hidden Field status (AD-14): always mounted, empty at
 * first, and only ever carrying field validation.
 */
function useFieldStatus() {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);

  function cancel() {
    clearTimeout(timer.current);
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    timer.current = undefined;
    frame.current = undefined;
  }

  useEffect(() => cancel, []);

  return {
    text,
    clear() {
      cancel();
      setText('');
    },
    /** Says it once, then empties so browse mode doesn't read it again. */
    sayFor(message: string, ms: number) {
      cancel();
      setText(message);
      timer.current = setTimeout(() => setText(''), ms);
    },
    /** Cleared, then set on the next frame, so a repeat is spoken again. */
    sayAgain(message: string) {
      cancel();
      setText('');
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        setText(message);
      });
    },
  };
}

export function AddForm({ fieldRef: externalFieldRef }: { fieldRef?: Ref<HTMLTextAreaElement> } = {}) {
  const addTodo = useAddTodo();
  const [value, setValue] = useState('');
  const [emptyShown, setEmptyShown] = useState(false);
  const status = useFieldStatus();
  // The latest committed value, read after an add's promise resolves.
  const valueRef = useRef(value);
  valueRef.current = value;
  // A failed add's text put back in the field, until its id is listed or it is replaced.
  const restored = useRef<{ id: string; text: string } | null>(null);
  const caretToEnd = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // The add field is a focus target outside the form too (Dismiss, Try again).
  useImperativeHandle(externalFieldRef, () => fieldRef.current!, []);
  const selection = useRef<[number, number] | null>(null);
  const wasOver = useRef(false);
  const fieldId = useId();
  const counterId = useId();
  const hintId = useId();
  const errorId = useId();

  const count = countCodePoints(prepareDescription(value));
  const over = count > DESCRIPTION_MAX_LENGTH;
  const invalid = emptyShown || over;

  useAutoGrow(fieldRef, value);

  // A cleaned value moves the caret to the end; put it back where it was.
  // Each replacement is one character for one, so the offsets still hold.
  useLayoutEffect(() => {
    const range = selection.current;
    const el = fieldRef.current;
    if (!range || !el) return;
    selection.current = null;
    el.setSelectionRange(range[0], range[1]);
  }, [value]);

  // Restored text puts the caret at its end, if focus is still in the field (EXPERIENCE Focus management).
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!caretToEnd.current || !el) return;
    caretToEnd.current = false;
    if (document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  }, [value]);

  // Add landed after all: the failed add's id is listed, so its restored text clears,
  // only if it is still exactly that text. Focus stays and nothing is spoken.
  useLandedAfterAll((ids) => {
    const landed = restored.current;
    if (!landed || !ids.has(landed.id)) return;
    restored.current = null;
    setValue((current) => (current === landed.text ? '' : current));
  });

  // The crossing above the limit is spoken once; dropping back clears silently.
  useEffect(() => {
    if (over === wasOver.current) return;
    wasOver.current = over;
    if (over) status.sayFor(messages.inline.overLimit, CROSSING_CLEAR_MS);
    else status.clear();
    // `status` is a fresh object each render; only the crossing matters here.
  }, [over]);

  // Native listeners: React has no paste-with-cancel insert path that keeps the
  // undo stack, and its onBeforeInput carries no `inputType`.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;

    function handlePaste(event: ClipboardEvent) {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;
      const cleaned = replaceForbidden(text);
      if (cleaned === text) return;
      event.preventDefault();
      // insertText keeps the native undo stack, fires `input` and puts the caret after the text.
      // Where the engine lacks it or refuses, insert directly and fire `input` ourselves.
      const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, cleaned);
      if (!inserted) {
        el!.setRangeText(cleaned, el!.selectionStart, el!.selectionEnd, 'end');
        el!.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Keyboards that keep every word composing send Enter as a line break here.
    function handleBeforeInput(event: InputEvent) {
      if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return;
      event.preventDefault();
      el!.form?.requestSubmit();
    }

    el.addEventListener('paste', handlePaste);
    el.addEventListener('beforeinput', handleBeforeInput);
    return () => {
      el.removeEventListener('paste', handlePaste);
      el.removeEventListener('beforeinput', handleBeforeInput);
    };
  }, []);

  function update(next: string) {
    setValue(next);
    if (emptyShown && prepareDescription(next) !== '') {
      setEmptyShown(false);
      status.clear();
    }
  }

  /** Cleans the field's value, keeping the selection, unless nothing changes. */
  function clean(el: HTMLTextAreaElement) {
    const raw = el.value;
    const cleaned = replaceForbidden(raw);
    if (cleaned !== raw) {
      const { selectionStart: start, selectionEnd: end } = el;
      // Unchanged state means no render and no layout effect: restore once React
      // has written the value back, so no stale selection survives.
      if (cleaned === value) queueMicrotask(() => el.setSelectionRange(start, end));
      else selection.current = [start, end];
    }
    update(cleaned);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    // The value is never rewritten while an IME composition is open.
    if ((event.nativeEvent as InputEvent).isComposing) {
      update(event.target.value);
      return;
    }
    clean(event.target);
  }

  function refuse(message: string) {
    status.sayAgain(message);
    fieldRef.current?.focus();
  }

  async function submit() {
    const description = prepareDescription(value);
    const problem = checkDescription(description);
    if (problem === 'empty') {
      setEmptyShown(true);
      refuse(messages.inline.empty);
      return;
    }
    if (problem === 'too-long') {
      refuse(messages.inline.overLimit);
      return;
    }
    // 'forbidden-character' can't happen after the replace (AD-8); it has no copy of its own.
    if (problem !== null) return;

    // A failed add's restored text, submitted unchanged, goes with that add's id, so
    // an add the server stored after all replays (AD-6) instead of being stored twice.
    const reuse = restored.current?.text === description ? restored.current.id : undefined;

    // Submitted: the card is on top at once (the helper), the field clears and
    // focus stays in it, even when Add was pressed (EXPERIENCE Focus management).
    restored.current = null;
    setValue('');
    fieldRef.current?.focus();
    const outcome = await addTodo(description, reuse);
    if (outcome.status !== 'failed') return;

    // Add failed: the sent text comes back only into an empty field, so newer typing is kept.
    if (valueRef.current !== '') return;
    restored.current = { id: outcome.id, text: description };
    caretToEnd.current = true;
    setValue((current) => (current === '' ? description : current));
    // The restored text is valid: clear an empty-submit error made while the add was pending.
    setEmptyShown(false);
    status.clear();
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

  const describedBy = `${emptyShown ? `${errorId} ` : ''}${counterId} ${hintId}`;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={fieldId}>
        New todo
      </label>
      <div className={styles.row}>
        <div className={invalid ? `${styles.field} ${styles.fieldInvalid}` : styles.field}>
          <textarea
            ref={fieldRef}
            id={fieldId}
            className={styles.textarea}
            value={value}
            rows={1}
            enterKeyHint="done"
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            onChange={handleChange}
            onCompositionEnd={(event) => clean(event.currentTarget)}
            onKeyDown={handleKeyDown}
          />
          <div className={styles.footer}>
            <span id={counterId} className={over ? `${styles.counter} ${styles.counterOver}` : styles.counter}>
              {over && (
                <svg className={styles.counterIcon} viewBox="0 0 16 16" aria-hidden="true">
                  <path className={styles.counterIconTriangle} d="M8 1.2 15.4 14.4H.6z" />
                  <path className={styles.counterIconMark} d="M8 6v3.8M8 12.2v.1" />
                </svg>
              )}
              {messages.inline.counter(count)}
              {over && <span className="visually-hidden">{messages.inline.overLimitSuffix}</span>}
            </span>
          </div>
        </div>
        <button type="submit" className={styles.add}>
          Add
        </button>
      </div>
      {emptyShown && (
        <p id={errorId} className={styles.inlineError}>
          <span className={styles.inlineErrorIcon} aria-hidden="true">
            !
          </span>
          <span>{messages.inline.empty}</span>
        </p>
      )}
      <span id={hintId} className="visually-hidden">
        {messages.inline.hintAdd}
      </span>
      <p className="visually-hidden" role="status">
        {status.text}
      </p>
    </form>
  );
}
