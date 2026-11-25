import { fireEvent } from '@testing-library/react';

export interface DropOptions {
  /** The dropped text, as the engine puts it in `beforeinput`'s `data`. */
  data: string | null;
  /** The drop point as an offset into the field's value, or null when the engine can't say. */
  pointsAt: number | null;
  /**
   * Whether the engine focuses the field and collapses its selection at the drop
   * point before `beforeinput`, as Chrome and Safari do.
   */
  movesCaret?: boolean;
}

/**
 * A drop onto a text field as an engine delivers it: a `drop` event whose point
 * `document.caretPositionFromPoint` resolves to `pointsAt` in the field, then the
 * field focused and its selection collapsed there when `movesCaret`, then the
 * cancelable `beforeinput` `insertFromDrop`. Returns that `beforeinput` event.
 * jsdom has no drag path of its own.
 */
export function dropOnto(field: HTMLTextAreaElement, { data, pointsAt, movesCaret = true }: DropOptions): InputEvent {
  const doc = document as { caretPositionFromPoint?: unknown };
  const own = Object.getOwnPropertyDescriptor(document, 'caretPositionFromPoint');
  Object.defineProperty(document, 'caretPositionFromPoint', {
    configurable: true,
    value: () => (pointsAt === null ? null : { offsetNode: field, offset: pointsAt }),
  });
  try {
    fireEvent.drop(field);
  } finally {
    if (own) Object.defineProperty(document, 'caretPositionFromPoint', own);
    else delete doc.caretPositionFromPoint;
  }
  if (movesCaret && pointsAt !== null) {
    field.focus();
    field.setSelectionRange(pointsAt, pointsAt);
  }
  const event = new InputEvent('beforeinput', { inputType: 'insertFromDrop', data, bubbles: true, cancelable: true });
  fireEvent(field, event);
  return event;
}
