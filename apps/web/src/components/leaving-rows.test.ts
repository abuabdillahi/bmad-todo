import type { Todo } from '@todo/contract';
import { isLive, mergeRows, withoutLeft, type LeavingEntry } from './leaving-rows.ts';

const todo = (n: number): Todo => ({
  id: `a0000000-0000-4000-8000-00000000000${n}`,
  description: `Todo ${n}`,
  completed: false,
  createdAt: '2026-11-25T10:00:00.000Z',
});
const [a, b, c] = [todo(1), todo(2), todo(3)];

function entry(t: Todo, index: number, extra: Partial<LeavingEntry> = {}): LeavingEntry {
  return { todo: t, index, revertedAt: undefined, settled: false, ...extra };
}

const never = () => undefined;
const shape = (rows: ReturnType<typeof mergeRows>) => rows.map((row) => row.key);

describe('mergeRows (AD-11 Leaving rows)', () => {
  it('U4 renders the cache as normal rows keyed by id when nothing is leaving', () => {
    expect(mergeRows([a, b], new Map(), never)).toEqual([
      { key: a.id, todo: a, leaving: false },
      { key: b.id, todo: b, leaving: false },
    ]);
  });

  it('U4 a todo still in the cache with a live entry renders as its Leaving copy in place', () => {
    const rows = mergeRows([a, b, c], new Map([[b.id, entry(b, 1)]]), never);
    expect(shape(rows)).toEqual([a.id, `leaving:${b.id}`, c.id]);
    expect(rows[1]!.leaving).toBe(true);
  });

  it('U4 an entry whose todo left the cache is inserted at its index, or at the end', () => {
    expect(shape(mergeRows([a, c], new Map([[b.id, entry(b, 1)]]), never))).toEqual([a.id, `leaving:${b.id}`, c.id]);
    expect(shape(mergeRows([a], new Map([[c.id, entry(c, 5)]]), never))).toEqual([a.id, `leaving:${c.id}`]);
  });

  it('U4 two rows deleted in a row land where each showed, whichever was confirmed first', () => {
    // b first (index 1 of a, b, c), then a (index 0 of a, b-leaving, c).
    const leaving = new Map([
      [b.id, entry(b, 1)],
      [a.id, entry(a, 0)],
    ]);
    expect(shape(mergeRows([c], leaving, never))).toEqual([`leaving:${a.id}`, `leaving:${b.id}`, c.id]);
  });

  it('U4 an entry whose revert time changed is dropped: the restored todo renders normally, keyed by id', () => {
    const leaving = new Map([[b.id, entry(b, 1, { revertedAt: 10 })]]);
    const reverted = (id: string) => (id === b.id ? 20 : undefined);
    expect(mergeRows([a, b, c], leaving, reverted)).toEqual([
      { key: a.id, todo: a, leaving: false },
      { key: b.id, todo: b, leaving: false },
      { key: c.id, todo: c, leaving: false },
    ]);
    expect(isLive(leaving.get(b.id)!, new Set([a.id, b.id, c.id]), reverted)).toBe(false);
  });

  it('U4 a changed revert time with the todo still gone keeps the entry live, rendered at its index', () => {
    // A call queued before the delete failed: its revert re-applied the delete, so the todo stays gone.
    const leaving = new Map([[b.id, entry(b, 1, { revertedAt: 10 })]]);
    const reverted = (id: string) => (id === b.id ? 20 : undefined);
    expect(isLive(leaving.get(b.id)!, new Set([a.id, c.id]), reverted)).toBe(true);
    expect(shape(mergeRows([a, c], leaving, reverted))).toEqual([a.id, `leaving:${b.id}`, c.id]);
  });

  it('U4 a settled entry whose todo is in the cache is not live; one whose todo is gone still is', () => {
    const settled = entry(b, 1, { settled: true });
    expect(isLive(settled, new Set([a.id, b.id]), never)).toBe(false);
    expect(isLive(settled, new Set([a.id]), never)).toBe(true);
    expect(shape(mergeRows([a, b], new Map([[b.id, settled]]), never))).toEqual([a.id, b.id]);
  });

  it('U4 withoutLeft drops an entry and moves the ones after it up one place', () => {
    const leaving = new Map([
      [a.id, entry(a, 0)],
      [b.id, entry(b, 1)],
      [c.id, entry(c, 3)],
    ]);
    const next = withoutLeft(leaving, b.id);
    expect([...next.keys()]).toEqual([a.id, c.id]);
    expect(next.get(a.id)!.index).toBe(0);
    expect(next.get(c.id)!.index).toBe(2);
  });
});
