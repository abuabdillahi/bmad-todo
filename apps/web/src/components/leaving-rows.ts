import type { Todo } from '@todo/contract';

/** A row the user confirmed deleting, kept by the list area for its leave motion (AD-11). */
export interface LeavingEntry {
  /** The todo as it showed when the delete was confirmed. */
  readonly todo: Todo;
  /** Its place among the rendered rows when the delete was confirmed. */
  readonly index: number;
  /** `revertedAt(id)` when the delete was confirmed: a later value means the delete failed and the todo is back. */
  readonly revertedAt: number | undefined;
  /** The delete's promise has settled. */
  readonly settled: boolean;
}

/** One rendered row: a todo from the cache, or a Leaving copy. */
export interface Row {
  readonly key: string;
  readonly todo: Todo;
  readonly leaving: boolean;
}

/**
 * Whether an entry still renders as a Leaving copy. Once its todo has left the
 * cache it is live until its leave timer runs: a revert that keeps it gone (a
 * failed call queued before the delete, whose revert re-applies the delete)
 * doesn't end it. With the todo in the cache it is live only until a revert
 * restored it (the delete failed) or its delete settled (dropped behind a
 * failed create, or a refetch brought it back). Entries that aren't live are
 * dropped by the list area.
 */
export function isLive(entry: LeavingEntry, cached: ReadonlySet<string>, revertedAt: (id: string) => number | undefined): boolean {
  const { id } = entry.todo;
  if (!cached.has(id)) return true;
  return revertedAt(id) === entry.revertedAt && !entry.settled;
}

/**
 * The rows the list area renders (AD-11): the cache's todos in order, a todo
 * with a live entry as its Leaving copy in place, and each live entry whose
 * todo has left the cache inserted back at its confirmed index (or at the end).
 * Leaving copies are keyed `leaving:{id}` and normal rows `{id}`, so a
 * confirmed row remounts as its copy and a restored row mounts fresh.
 */
export function mergeRows(
  todos: readonly Todo[],
  leaving: ReadonlyMap<string, LeavingEntry>,
  revertedAt: (id: string) => number | undefined,
): Row[] {
  const cached = new Set(todos.map((todo) => todo.id));
  const live = new Map([...leaving].filter(([, entry]) => isLive(entry, cached, revertedAt)));
  const rows: Row[] = todos.map((todo) => {
    const entry = live.get(todo.id);
    return entry ? leavingRow(entry) : { key: todo.id, todo, leaving: false };
  });
  const gone = [...live.values()].filter((entry) => !cached.has(entry.todo.id)).sort((a, b) => a.index - b.index);
  for (const entry of gone) rows.splice(Math.min(entry.index, rows.length), 0, leavingRow(entry));
  return rows;
}

function leavingRow(entry: LeavingEntry): Row {
  return { key: `leaving:${entry.todo.id}`, todo: entry.todo, leaving: true };
}

/**
 * The entries once `id`'s Leaving copy has unmounted: the ones after it move up
 * one place, so a row confirmed later still lands where it showed.
 */
export function withoutLeft(leaving: ReadonlyMap<string, LeavingEntry>, id: string): Map<string, LeavingEntry> {
  const left = leaving.get(id);
  const next = new Map<string, LeavingEntry>();
  for (const [key, entry] of leaving) {
    if (key === id) continue;
    next.set(key, left !== undefined && entry.index > left.index ? { ...entry, index: entry.index - 1 } : entry);
  }
  return next;
}
