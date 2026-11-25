import { createLoadingStatus, LINE_CLEAR_MS, LOADING_DELAY_MS, stepOf } from './loading-status.ts';

const ERROR = "Couldn't load your todos. Check your connection and try again.";
const OTHER = "Couldn't load your todos. The server isn't available right now. Try again in a moment.";

/** A status over a plain string, with a manual next frame. */
function setup() {
  let text = '';
  const writes: string[] = [];
  let frame: (() => void) | undefined;
  const status = createLoadingStatus({
    write: (next) => {
      text = next;
      writes.push(next);
    },
    read: () => text,
    nextFrame: (callback) => {
      frame = callback;
      return () => (frame = undefined);
    },
  });
  return {
    status,
    writes,
    text: () => text,
    runFrame: () => {
      const run = frame;
      frame = undefined;
      run?.();
    },
  };
}

describe('loading status', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([
    [undefined, 'loading', 'enter-loading'],
    [undefined, 'error', 'enter-error'],
    [undefined, 'populated', 'become-loaded'],
    ['loading', 'loading', null],
    ['loading', 'error', 'enter-error'],
    ['error', 'error', null],
    ['error', 'loading', 'enter-loading'],
    ['loading', 'empty', 'become-loaded'],
    ['error', 'populated', 'become-loaded'],
    ['populated', 'empty', null],
    ['empty', 'populated', null],
  ] as const)('K5 steps from %s to %s as %s', (previous, current, step) => {
    expect(stepOf(previous, current)).toBe(step);
  });

  it('K5 says nothing at mount and "Loading your todos" only after 500 ms', () => {
    const { status, text } = setup();
    status.update('loading', '', false);
    expect(text()).toBe('');
    vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
    expect(text()).toBe('');
    vi.advanceTimersByTime(1);
    expect(text()).toBe('Loading your todos');
  });

  it('K5 a load under 500 ms stays silent, before and after', () => {
    const { status, writes } = setup();
    status.update('loading', '', false);
    vi.advanceTimersByTime(LOADING_DELAY_MS - 100);
    status.update('populated', '', false);
    vi.advanceTimersByTime(LINE_CLEAR_MS * 2);
    expect(writes.every((written) => written === '')).toBe(true);
  });

  it('K5 a slow load ends with the recovery line, emptied 5 s later, then stays silent', () => {
    const { status, text } = setup();
    status.update('loading', '', false);
    vi.advanceTimersByTime(LOADING_DELAY_MS);
    status.update('populated', '', false);
    expect(text()).toBe('Your todos are loaded.');
    vi.advanceTimersByTime(LINE_CLEAR_MS);
    expect(text()).toBe('');
    status.update('empty', '', false);
    status.update('populated', '', false);
    expect(text()).toBe('');
  });

  it('K5 the recovery line is not spoken when focus moved to the list', () => {
    const { status, text } = setup();
    status.update('error', ERROR, false);
    status.update('populated', '', true);
    expect(text()).toBe('');
  });

  it('K5 entering error says the line and empties it 5 s later; a new kind while in error says nothing', () => {
    const { status, text, writes } = setup();
    status.update('loading', '', false);
    status.update('error', ERROR, false);
    expect(text()).toBe(ERROR);
    const count = writes.length;
    status.update('error', OTHER, false);
    expect(writes).toHaveLength(count);
    vi.advanceTimersByTime(LINE_CLEAR_MS);
    expect(text()).toBe('');
  });

  it('K5 a recovery long after the error line emptied still speaks', () => {
    const { status, text } = setup();
    status.update('error', ERROR, false);
    vi.advanceTimersByTime(LINE_CLEAR_MS * 3);
    expect(text()).toBe('');
    status.update('empty', '', false);
    expect(text()).toBe('Your todos are loaded.');
  });

  it('K5 each entry cancels the pending timer, so an old timer never clears a newer line', () => {
    const { status, text } = setup();
    status.update('error', ERROR, false);
    vi.advanceTimersByTime(LINE_CLEAR_MS - 100);
    status.update('loading', '', false);
    expect(text()).toBe('');
    vi.advanceTimersByTime(LOADING_DELAY_MS);
    expect(text()).toBe('Loading your todos');
    vi.advanceTimersByTime(LINE_CLEAR_MS);
    expect(text()).toBe('Loading your todos');
    // A failed Try again speaks the error line again.
    status.update('error', ERROR, false);
    expect(text()).toBe(ERROR);
  });

  it('K5 a repeat of the line showing is emptied and set again on the next frame', () => {
    const { status, text, runFrame } = setup();
    status.update('error', ERROR, false);
    status.reset();
    status.update('error', ERROR, false);
    expect(text()).toBe('');
    runFrame();
    expect(text()).toBe(ERROR);
  });

  it('K5 the 5 s clear cancels a repeat\'s pending frame, so the line is not set back after it', () => {
    const { status, text, runFrame } = setup();
    status.update('error', ERROR, false);
    status.reset();
    status.update('error', ERROR, false);
    expect(text()).toBe('');
    // The frame hasn't run (a hidden tab pauses it) when the 5 s clear fires.
    vi.advanceTimersByTime(LINE_CLEAR_MS);
    expect(text()).toBe('');
    runFrame();
    expect(text()).toBe('');
  });

  it('K5 reset cancels the timers; before the load it lets the next update enter again, after it nothing', () => {
    const { status, text, writes } = setup();
    status.update('loading', '', false);
    status.reset();
    vi.advanceTimersByTime(LOADING_DELAY_MS);
    expect(text()).toBe('');
    status.update('loading', '', false);
    vi.advanceTimersByTime(LOADING_DELAY_MS);
    expect(text()).toBe('Loading your todos');
    status.update('populated', '', false);
    expect(text()).toBe('Your todos are loaded.');
    status.reset();
    const count = writes.length;
    status.update('populated', '', false);
    expect(writes).toHaveLength(count);
  });
});
