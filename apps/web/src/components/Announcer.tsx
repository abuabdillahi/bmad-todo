import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { Announcement } from '../todos/announcer.ts';
import { useAnnouncement, useAnnouncer } from '../todos/hooks.ts';
import { messages } from '../todos/messages.ts';
import styles from './Announcer.module.css';

export interface AnnouncerFocusTargets {
  addField: RefObject<HTMLTextAreaElement | null>;
  heading: RefObject<HTMLHeadingElement | null>;
}

/** The fade-out length: `--motion-duration-fast`, or 0 under reduced motion. */
function leaveDuration(): number {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--motion-duration-fast').trim();
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return 150;
  return raw.endsWith('ms') ? value : value * 1000;
}

/** Sets `--announcer-block-size` on the root while a message shows, and `0px` once it clears (DESIGN Components › Announcer). */
function useBlockSize(region: RefObject<HTMLDivElement | null>, shown: boolean): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = region.current;
    if (!shown || !el) {
      root.style.setProperty('--announcer-block-size', '0px');
      return;
    }
    const measure = () => {
      const bottom = Number.parseFloat(getComputedStyle(el).bottom) || 0;
      const gap = Number.parseFloat(getComputedStyle(root).getPropertyValue('--space-2')) || 8;
      root.style.setProperty('--announcer-block-size', `${el.getBoundingClientRect().height + bottom + gap}px`);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [region, shown]);
}

function Icon() {
  return (
    <span className={styles.icon} aria-hidden="true">
      !
    </span>
  );
}

function variantClass(message: Announcement): string {
  return message.kind === 'status' ? styles.status! : styles.failure!;
}

/**
 * The one Announcer (AD-14, EXPERIENCE Component Patterns › Announcer): a
 * bottom overlay whose live element is always mounted and wraps only the
 * text. The icon is hidden from assistive tech and Dismiss sits outside the
 * live element.
 */
export function Announcer({ focusTargets }: { focusTargets: AnnouncerFocusTargets }) {
  const { message, spoken } = useAnnouncement();
  const announcer = useAnnouncer();
  const regionRef = useRef<HTMLDivElement>(null);
  const lastPointerType = useRef<string | null>(null);
  const [leaving, setLeaving] = useState<Announcement | null>(null);

  useBlockSize(regionRef, message !== null);

  // The fading copy goes when its fade ends, or at once when a new message shows
  // (it is not rendered beside a message, so the two never paint together).
  useEffect(() => {
    if (leaving === null) return;
    if (message !== null) {
      setLeaving(null);
      return;
    }
    const timer = setTimeout(() => setLeaving(null), leaveDuration());
    return () => clearTimeout(timer);
  }, [leaving, message]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    lastPointerType.current = event.pointerType;
  }

  function handleDismiss() {
    const touch = lastPointerType.current === 'touch' || lastPointerType.current === 'pen';
    lastPointerType.current = null;
    // Hand-off order: focus moves before Dismiss is removed, so it never drops to <body>.
    // After a touch the heading takes it, so the phone keyboard stays closed.
    if (touch) focusTargets.heading.current?.focus({ preventScroll: true });
    else focusTargets.addField.current?.focus();
    if (message !== null && leaveDuration() > 0) setLeaving(message);
    announcer.dismiss();
  }

  const regionClass = message === null ? styles.region : `${styles.region} ${styles.shown} ${variantClass(message)}`;

  return (
    <>
      <div ref={regionRef} className={regionClass}>
        {message?.kind !== 'status' && message !== null && <Icon />}
        <p className={styles.message} role="status" aria-live="polite">
          {spoken}
        </p>
        {message !== null && (
          <button
            type="button"
            className={styles.dismiss}
            onPointerDown={handlePointerDown}
            onKeyDown={() => (lastPointerType.current = null)}
            onClick={handleDismiss}
          >
            {messages.dismiss}
          </button>
        )}
      </div>
      {leaving !== null && message === null && (
        <div className={`${styles.region} ${styles.shown} ${styles.leaving} ${variantClass(leaving)}`} aria-hidden="true">
          {leaving.kind !== 'status' && <Icon />}
          <span className={styles.message}>{leaving.text}</span>
          <span className={styles.dismiss}>{messages.dismiss}</span>
        </div>
      )}
    </>
  );
}
