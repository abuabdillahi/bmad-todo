import { desc, eq, sql } from 'drizzle-orm';
import type { Todo } from '@todo/contract';
import type { Db } from '../db/client.ts';
import { todos, type TodoRow } from '../db/schema.ts';

export interface NewTodo {
  id: string;
  description: string;
}

export interface TodoRepository {
  list(): Todo[];
  /** The stored todo with this id, or `undefined`. */
  findById(id: string): Todo | undefined;
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

/** Every read and write of todo data goes through here (AD-10, AD-12). */
export function createTodoRepository(db: Db, now: () => number = Date.now): TodoRepository {
  return {
    list() {
      return db.select().from(todos).orderBy(desc(todos.createdAt), desc(todos.id)).all().map(toTodo);
    },

    findById(id) {
      const row = db.select().from(todos).where(eq(todos.id, id)).get();
      return row === undefined ? undefined : toTodo(row);
    },

    create({ id, description }) {
      const row = db
        .insert(todos)
        .values({ id, description, completed: false, createdAt: now() })
        .returning()
        .get();
      return toTodo(row);
    },

    ping() {
      db.get(sql`select 1`);
    },
  };
}
