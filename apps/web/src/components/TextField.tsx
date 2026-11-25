import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import { checkDescription, DESCRIPTION_MAX_LENGTH } from '@todo/contract/description';
import { messages } from '../todos/messages.ts';
import { countCodePoints, prepareDescription, replaceForbidden } from './description-input.ts';
import styles from './TextField.module.css';

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
 * The field's one hidden Field status (AD-14): always mounted, empty at first,
 * and only ever carrying field validation.
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

export interface TextFieldOptions {
  /** The hidden hint in the field's description: `messages.inline.hintAdd` or `hintEdit`. */
  hint: string;
  /** The value the field starts with (read once, at mount). */
  initial?: string;
}

/** One text field's state and operations (add and edit share it: one implementation of AD-8's rules). */
export interface TextField {
  readonly value: string;
  /** Programmatic set, for the add form's clear and restore. */
  readonly setValue: Dispatch<SetStateAction<string>>;
  /** The textarea. */
  readonly ref: RefObject<HTMLTextAreaElement | null>;
  /** The textarea's id, for its `<label>`. */
  readonly id: string;
  /**
   * Prepares and checks the value (AD-8). Valid: returns the prepared text.
   * Empty: shows the Inline error, says it again and focuses the field. Too
   * long: says the over-limit message again and focuses the field. Both
   * return null.
   */
  submitValue(): string | null;
  /** Clears the empty error and the Field status, for the restore after a failed add. */
  clearError(): void;
  /** For the render pieces only. */
  readonly view: TextFieldView;
}

interface TextFieldView {
  readonly hint: string;
  readonly count: number;
  readonly over: boolean;
  readonly emptyShown: boolean;
  readonly statusText: string;
  readonly counterId: string;
  readonly hintId: string;
  readonly errorId: string;
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly onCompositionEnd: (el: HTMLTextAreaElement) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * The add and edit fields' rules (AD-8, EXPERIENCE Component Patterns › Text
 * field and Field status): cleaning on paste and input, the selection restore,
 * composition, Enter and Shift+Enter, the counter, the over-limit crossing
 * speech, the Inline error and the blocked-submit Field status.
 */
export function useTextField({ hint, initial = '' }: TextFieldOptions): TextField {
  const [value, setValue] = useState(initial);
  const [emptyShown, setEmptyShown] = useState(false);
  const status = useFieldStatus();
  const ref = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<[number, number] | null>(null);
  const wasOver = useRef(false);
  const id = useId();
  const counterId = useId();
  const hintId = useId();
  const errorId = useId();

  const count = countCodePoints(prepareDescription(value));
  const over = count > DESCRIPTION_MAX_LENGTH;

  useAutoGrow(ref, value);

  // A cleaned value moves the caret to the end; put it back where it was.
  // Each replacement is one character for one, so the offsets still hold.
  useLayoutEffect(() => {
    const range = selection.current;
    const el = ref.current;
    if (!range || !el) return;
    selection.current = null;
    el.setSelectionRange(range[0], range[1]);
  }, [value]);

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
    const el = ref.current;
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

    // `beforeinput` carries no modifier state: Shift comes from the latest key event.
    // Keyup counts too, so a Shift released since the last keydown no longer blocks.
    let shiftHeld = false;
    function trackShift(event: globalThis.KeyboardEvent) {
      shiftHeld = event.shiftKey;
    }
    // A Shift released after focus leaves (Shift+Tab, a window switch) never reaches the keyup.
    function forgetShift() {
      shiftHeld = false;
    }

    // Keyboards that keep every word composing send Enter, and Shift+Enter, as a
    // line break here. It is never inserted, and only Enter without Shift submits.
    function handleBeforeInput(event: InputEvent) {
      if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return;
      event.preventDefault();
      if (shiftHeld) return;
      el!.form?.requestSubmit();
    }

    el.addEventListener('paste', handlePaste);
    el.addEventListener('keydown', trackShift);
    el.addEventListener('keyup', trackShift);
    el.addEventListener('blur', forgetShift);
    el.addEventListener('beforeinput', handleBeforeInput);
    return () => {
      el.removeEventListener('paste', handlePaste);
      el.removeEventListener('keydown', trackShift);
      el.removeEventListener('keyup', trackShift);
      el.removeEventListener('blur', forgetShift);
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
    ref.current?.focus();
  }

  function submitValue(): string | null {
    const description = prepareDescription(value);
    const problem = checkDescription(description);
    if (problem === 'empty') {
      setEmptyShown(true);
      refuse(messages.inline.empty);
      return null;
    }
    if (problem === 'too-long') {
      refuse(messages.inline.overLimit);
      return null;
    }
    // 'forbidden-character' can't happen after the replace (AD-8); it has no copy of its own.
    if (problem !== null) return null;
    return description;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return;
    // Enter never inserts a newline, and doesn't submit while an IME composition is open.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (event.shiftKey) return;
    event.currentTarget.form?.requestSubmit();
  }

  return {
    value,
    setValue,
    ref,
    id,
    submitValue,
    clearError() {
      setEmptyShown(false);
      status.clear();
    },
    view: {
      hint,
      count,
      over,
      emptyShown,
      statusText: status.text,
      counterId,
      hintId,
      errorId,
      onChange: handleChange,
      onCompositionEnd: clean,
      onKeyDown: handleKeyDown,
    },
  };
}

/**
 * The Text field box (DESIGN.md Components › Text field): the textarea and the
 * Character counter footer. `contentClassName` goes on the textarea and the
 * footer, never on the box, so the box's focus ring is never faded with them.
 */
export function TextFieldBox({ field, contentClassName }: { field: TextField; contentClassName?: string }) {
  const { value, ref, id, view } = field;
  const invalid = view.emptyShown || view.over;
  const describedBy = `${view.emptyShown ? `${view.errorId} ` : ''}${view.counterId} ${view.hintId}`;
  const withContent = (className: string) => (contentClassName ? `${className} ${contentClassName}` : className);

  return (
    <div className={invalid ? `${styles.field} ${styles.fieldInvalid}` : styles.field}>
      <textarea
        ref={ref}
        id={id}
        className={withContent(styles.textarea!)}
        value={value}
        rows={1}
        enterKeyHint="done"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={view.onChange}
        onCompositionEnd={(event) => view.onCompositionEnd(event.currentTarget)}
        onKeyDown={view.onKeyDown}
      />
      <div className={withContent(styles.footer!)}>
        <span id={view.counterId} className={view.over ? `${styles.counter} ${styles.counterOver}` : styles.counter}>
          {view.over && (
            <svg className={styles.counterIcon} viewBox="0 0 16 16" aria-hidden="true">
              <path className={styles.counterIconTriangle} d="M8 1.2 15.4 14.4H.6z" />
              <path className={styles.counterIconMark} d="M8 6v3.8M8 12.2v.1" />
            </svg>
          )}
          {messages.inline.counter(view.count)}
          {view.over && <span className="visually-hidden">{messages.inline.overLimitSuffix}</span>}
        </span>
      </div>
    </div>
  );
}

/**
 * Under the box, in order: the Inline error (only after an empty submit), the
 * hidden hint, and the always-mounted hidden Field status (AD-14).
 */
export function TextFieldNotes({ field }: { field: TextField }) {
  const { view } = field;
  return (
    <>
      {view.emptyShown && (
        <p id={view.errorId} className={styles.inlineError}>
          <span className={styles.inlineErrorIcon} aria-hidden="true">
            !
          </span>
          <span>{messages.inline.empty}</span>
        </p>
      )}
      <span id={view.hintId} className="visually-hidden">
        {view.hint}
      </span>
      <p className="visually-hidden" role="status">
        {view.statusText}
      </p>
    </>
  );
}
