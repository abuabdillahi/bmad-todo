/**
 * The one app-level announcer (AD-14): an external store the Announcer region
 * renders. `failure` and `refresh` use the failure variant, `status` the status
 * variant.
 */
export type AnnouncementKind = 'failure' | 'refresh' | 'status';

export interface Announcement {
  readonly kind: AnnouncementKind;
  readonly text: string;
}

export interface AnnouncerSnapshot {
  /** What the banner shows; its chrome keys off this being non-null. */
  readonly message: Announcement | null;
  /** What the live element holds. A repeat empties it for one frame so it is spoken again. */
  readonly spoken: string;
}

export interface Announcer {
  subscribe(listener: () => void): () => void;
  getSnapshot(): AnnouncerSnapshot;
  announce(kind: AnnouncementKind, text: string): void;
  dismiss(): void;
}

/** Runs the callback on the next frame and returns a function that cancels it. */
export type NextFrame = (callback: () => void) => () => void;

export const animationFrame: NextFrame = (callback) => {
  const id = requestAnimationFrame(() => callback());
  return () => cancelAnimationFrame(id);
};

const EMPTY: AnnouncerSnapshot = { message: null, spoken: '' };

export function createAnnouncer({ nextFrame = animationFrame }: { nextFrame?: NextFrame } = {}): Announcer {
  let snapshot = EMPTY;
  let cancelFrame: (() => void) | undefined;
  const listeners = new Set<() => void>();

  function set(next: AnnouncerSnapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function cancelPending() {
    cancelFrame?.();
    cancelFrame = undefined;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    announce(kind, text) {
      const current = snapshot.message;
      // A refresh never replaces an undismissed failure; it is dropped, not queued.
      if (kind === 'refresh' && current?.kind === 'failure') return;
      // The same refresh still showing is left as it is, so it isn't repeated on every return.
      if (kind === 'refresh' && current?.kind === 'refresh' && current.text === text) return;

      cancelPending();
      const message: Announcement = { kind, text };
      if (current?.text === text) {
        // A repeat: clear the live text and set it again next frame; the banner stays.
        set({ message, spoken: '' });
        cancelFrame = nextFrame(() => {
          cancelFrame = undefined;
          set({ message, spoken: text });
        });
        return;
      }
      set({ message, spoken: text });
    },
    dismiss() {
      cancelPending();
      if (snapshot !== EMPTY) set(EMPTY);
    },
  };
}
