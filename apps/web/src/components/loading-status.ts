import { animationFrame, type NextFrame } from '../todos/announcer.ts';
import { messages } from '../todos/messages.ts';
import type { ListState } from '../todos/store.ts';

/** How long the list stays loading before the Loading status says so (AD-14, about 500 ms). */
export const LOADING_DELAY_MS = 500;
/** How long a spoken line stays before the Loading status empties again (AD-14). */
export const LINE_CLEAR_MS = 5000;

/** What a commit's list state means for the Loading status: an entry, becoming loaded, or nothing. */
export type StatusStep = 'enter-loading' | 'enter-error' | 'become-loaded' | null;

const isLoaded = (state: ListState | undefined): boolean => state === 'populated' || state === 'empty';

/**
 * The Loading status's step from the previous commit's list state to this
 * one's (AD-14, EXPERIENCE Component Patterns › Loading status). Entering
 * loading or error counts from anything else, mount included; staying in a
 * state is not an entry (a new failure kind while in Error says nothing).
 * Becoming loaded happens once; after it the status is silent for good.
 */
export function stepOf(previous: ListState | undefined, current: ListState): StatusStep {
  if (isLoaded(previous)) return null;
  if (current === 'loading') return previous === 'loading' ? null : 'enter-loading';
  if (current === 'error') return previous === 'error' ? null : 'enter-error';
  return 'become-loaded';
}

export interface LoadingStatusDeps {
  /** Sets the live element's text. */
  write(text: string): void;
  /** The live element's text now. */
  read(): string;
  nextFrame?: NextFrame;
}

export interface LoadingStatus {
  /**
   * Called once per commit, after any focus move: `errorLine` is the List error
   * panel's line, `movedToList` whether the list area moved focus to the Todo
   * list or the Empty panel in this commit.
   */
  update(state: ListState, errorLine: string, movedToList: boolean): void;
  /**
   * Cancels any pending timer or frame. Before the list is loaded it also
   * forgets the previous state, so the next update enters again; once loaded
   * it stays silent for good.
   */
  reset(): void;
}

/**
 * The one Loading status's line (AD-14): each entry cancels the pending 500 ms
 * or 5 s timer before starting its own, so an old timer never clears a newer
 * line. A repeat of the text showing is emptied and set again on the next frame.
 */
export function createLoadingStatus({ write, read, nextFrame = animationFrame }: LoadingStatusDeps): LoadingStatus {
  let previous: ListState | undefined;
  // It has set a non-empty line this page session, even one emptied since.
  let hasSpoken = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelFrame: (() => void) | undefined;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    cancelFrame?.();
    cancelFrame = undefined;
  }

  function after(ms: number, run: () => void) {
    timer = setTimeout(() => {
      timer = undefined;
      run();
    }, ms);
  }

  /** Empties the line, cancelling a repeat's pending frame so it can't set the line back. */
  function clear() {
    cancelFrame?.();
    cancelFrame = undefined;
    write('');
  }

  function say(text: string) {
    hasSpoken = true;
    if (read() !== text) {
      write(text);
      return;
    }
    write('');
    cancelFrame = nextFrame(() => {
      cancelFrame = undefined;
      write(text);
    });
  }

  return {
    update(state, errorLine, movedToList) {
      const step = stepOf(previous, state);
      previous = state;
      if (step === null) return;
      cancel();
      if (step === 'enter-loading') {
        clear();
        after(LOADING_DELAY_MS, () => say(messages.loading));
      } else if (step === 'enter-error') {
        say(errorLine);
        after(LINE_CLEAR_MS, clear);
      } else if (hasSpoken && !movedToList) {
        say(messages.loaded);
        after(LINE_CLEAR_MS, clear);
      } else {
        clear();
      }
    },
    reset() {
      cancel();
      if (!isLoaded(previous)) previous = undefined;
    },
  };
}
