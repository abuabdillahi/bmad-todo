import { useImperativeHandle, useLayoutEffect, useRef, type FormEvent, type Ref } from 'react';
import { useAddTodo, useLandedAfterAll } from '../todos/hooks.ts';
import { messages } from '../todos/messages.ts';
import { TextFieldBox, TextFieldNotes, useTextField } from './TextField.tsx';
import styles from './AddForm.module.css';

export function AddForm({ fieldRef: externalFieldRef }: { fieldRef?: Ref<HTMLTextAreaElement> } = {}) {
  const addTodo = useAddTodo();
  const field = useTextField({ hint: messages.inline.hintAdd });
  const { value, setValue, ref: fieldRef } = field;
  // The latest committed value, read after an add's promise resolves.
  const valueRef = useRef(value);
  valueRef.current = value;
  // A failed add's sent text put back in the field, until its id is listed or it is replaced.
  // An edited text restored instead is not recorded here: it never reuses the id or clears.
  const restored = useRef<{ id: string; text: string } | null>(null);
  const caretToEnd = useRef(false);
  // The add field is a focus target outside the form too (Dismiss, Try again).
  useImperativeHandle(externalFieldRef, () => fieldRef.current!, [fieldRef]);

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

  async function submit() {
    const description = field.submitValue();
    if (description === null) return;

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

    // Add failed: the todo's latest text comes back (#70), the sent text or the last edit
    // saved on its card while the add was pending; nothing if its delete was confirmed.
    const latest = outcome.latestDescription;
    if (latest === null) return;
    // Only into an empty field, so newer typing is kept.
    if (valueRef.current !== '') return;
    // Only the sent text lends the failed add's id: an edited text is a new todo, sent with a new id.
    if (latest === description) restored.current = { id: outcome.id, text: description };
    caretToEnd.current = true;
    setValue((current) => (current === '' ? latest : current));
    // The restored text is valid: clear an empty-submit error made while the add was pending.
    field.clearError();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={field.id}>
        New todo
      </label>
      <div className={styles.row}>
        <TextFieldBox field={field} />
        <button type="submit" className={styles.add}>
          Add
        </button>
      </div>
      <TextFieldNotes field={field} />
    </form>
  );
}
