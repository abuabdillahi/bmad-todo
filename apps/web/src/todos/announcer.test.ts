import { createAnnouncer } from './announcer.ts';

/** A manual frame queue standing in for requestAnimationFrame. */
function frames() {
  const pending = new Set<() => void>();
  return {
    nextFrame(callback: () => void) {
      pending.add(callback);
      return () => pending.delete(callback);
    },
    flush() {
      const callbacks = [...pending];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    get size() {
      return pending.size;
    },
  };
}

function setup() {
  const frame = frames();
  const announcer = createAnnouncer({ nextFrame: frame.nextFrame });
  const notified = vi.fn();
  announcer.subscribe(notified);
  return { announcer, frame, notified };
}

describe('announcer', () => {
  it('K7 starts empty', () => {
    const { announcer } = setup();
    expect(announcer.getSnapshot()).toEqual({ message: null, spoken: '' });
  });

  it('K7 shows and speaks a new message at once', () => {
    const { announcer, notified } = setup();
    announcer.announce('refresh', 'R');
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'refresh', text: 'R' }, spoken: 'R' });
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('K7 drops a refresh while an undismissed failure shows, without queueing it', () => {
    const { announcer, notified } = setup();
    announcer.announce('failure', 'F');
    announcer.announce('refresh', 'R');
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'failure', text: 'F' }, spoken: 'F' });
    announcer.dismiss();
    expect(announcer.getSnapshot()).toEqual({ message: null, spoken: '' });
    expect(notified).toHaveBeenCalledTimes(2);
  });

  it('K7 leaves an identical refresh that is still showing as it is', () => {
    const { announcer, frame, notified } = setup();
    announcer.announce('refresh', 'R');
    const before = announcer.getSnapshot();
    announcer.announce('refresh', 'R');
    expect(announcer.getSnapshot()).toBe(before);
    expect(frame.size).toBe(0);
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('K7 replaces a refresh with a refresh carrying another reason', () => {
    const { announcer } = setup();
    announcer.announce('refresh', 'R1');
    announcer.announce('refresh', 'R2');
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'refresh', text: 'R2' }, spoken: 'R2' });
  });

  it('K7 lets a status replace a failure, and a failure replace anything', () => {
    const { announcer } = setup();
    announcer.announce('failure', 'F');
    announcer.announce('status', 'S');
    expect(announcer.getSnapshot().message).toEqual({ kind: 'status', text: 'S' });
    announcer.announce('refresh', 'R');
    expect(announcer.getSnapshot().message).toEqual({ kind: 'refresh', text: 'R' });
    announcer.announce('failure', 'F2');
    expect(announcer.getSnapshot().message).toEqual({ kind: 'failure', text: 'F2' });
  });

  it('K7 clears a repeated message and sets it again next frame, keeping the banner', () => {
    const { announcer, frame } = setup();
    announcer.announce('failure', 'F');
    announcer.announce('failure', 'F');
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'failure', text: 'F' }, spoken: '' });
    frame.flush();
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'failure', text: 'F' }, spoken: 'F' });
  });

  it('K7 cancels a pending repeat frame on a newer message', () => {
    const { announcer, frame } = setup();
    announcer.announce('status', 'S');
    announcer.announce('status', 'S');
    announcer.announce('failure', 'F');
    expect(frame.size).toBe(0);
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'failure', text: 'F' }, spoken: 'F' });
  });

  it('K7 cancels a pending repeat frame on dismiss', () => {
    const { announcer, frame } = setup();
    announcer.announce('failure', 'F');
    announcer.announce('failure', 'F');
    announcer.dismiss();
    expect(frame.size).toBe(0);
    expect(announcer.getSnapshot()).toEqual({ message: null, spoken: '' });
  });

  it('K7 dismiss empties the message and the live text, and does nothing when already empty', () => {
    const { announcer, notified } = setup();
    announcer.dismiss();
    expect(notified).not.toHaveBeenCalled();
    announcer.announce('refresh', 'R');
    announcer.dismiss();
    expect(announcer.getSnapshot()).toEqual({ message: null, spoken: '' });
    announcer.announce('refresh', 'R');
    expect(announcer.getSnapshot()).toEqual({ message: { kind: 'refresh', text: 'R' }, spoken: 'R' });
  });
});
