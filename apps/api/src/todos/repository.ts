import Database from 'better-sqlite3';
import { desc, eq, sql } from 'drizzle-orm';
import type { Todo } from '@todo/contract';
import type { Db } from '../db/client.ts';
import { todos, type TodoRow } from '../db/schema.ts';
import { UnavailableError } from '../errors.ts';

export interface NewTodo {
  id: string;
  description: string;
}

export interface TodoRepository {
  /** Throws `UnavailableError` on a storage failure. */
  list(): Todo[];
  /** The stored todo with this id, or `undefined`. Throws `UnavailableError` on a storage failure. */
  findById(id: string): Todo | undefined;
  /** Throws `UnavailableError` on a storage failure. */
  create(todo: NewTodo): Todo;
  /** Throws when storage can't be reached. */
  ping(): void;
}

/** The only place that converts between the wire format and storage (AD-7). */
function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    description: row.description,
    completed: row.completed,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/**
 * Runs one database call. A storage failure (any `SqliteError`, or any error
 * while the connection is closed) becomes `UnavailableError` with the driver
 * error as `cause`; anything else is rethrown unchanged (AD-9).
 */
function fromStorage<T>(db: Db, query: () => T): T {
  try {
    return query();
  } catch (cause) {
    if (cause instanceof Database.SqliteError || !db.$client.open) {
      throw new UnavailableError('storage failed', { cause });
    }
    throw cause;
  }
}

/** Every read and write of todo data goes through here (AD-10, AD-12). */
export function createTodoRepository(db: Db, now: () => number = Date.now): TodoRepository {
  return {
    list() {
      const rows = fromStorage(db, () => db.select().from(todos).orderBy(desc(todos.createdAt), desc(todos.id)).all());
      return rows.map(toTodo);
    },

    findById(id) {
      const row = fromStorage(db, () => db.select().from(todos).where(eq(todos.id, id)).get());
      return row === undefined ? undefined : toTodo(row);
    },

    create({ id, description }) {
      const createdAt = now();
      const row = fromStorage(db, () =>
        db.insert(todos).values({ id, description, completed: false, createdAt }).returning().get(),
      );
      return toTodo(row);
    },

    ping() {
      db.get(sql`select 1`);
    },
  };
}
