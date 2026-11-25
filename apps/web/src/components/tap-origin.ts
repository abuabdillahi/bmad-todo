import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** Where an activation came from: a tap sends focus to the heading, so the phone keyboard stays closed. */
export interface TapOrigin {
  /** Notes the pointer's type; put it on the element (or an ancestor) the click lands on. */
  readonly onPointerDown: (event: PointerEvent<Element>) => void;
  /** Whether `event` came from a touch or pen tap, not from a mouse or the keyboard; clears the note. */
  readonly tapped: (event: MouseEvent<Element>) => boolean;
}

/**
 * Tells a tap from a click or a key press (EXPERIENCE Hand-off order): the last
 * pointerdown's type is touch or pen, and the click is a pointer's (`detail`
 * is 0 for a click from Enter or Space).
 */
export function useTapOrigin(): TapOrigin {
  const lastPointerType = useRef<string | null>(null);
  return {
    onPointerDown: (event) => {
      lastPointerType.current = event.pointerType;
    },
    tapped: (event) => {
      const type = lastPointerType.current;
      lastPointerType.current = null;
      return (type === 'touch' || type === 'pen') && event.detail !== 0;
    },
  };
}
