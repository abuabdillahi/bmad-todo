import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  /** Epoch milliseconds, set by the server (AD-7). */
  createdAt: integer('created_at').notNull(),
});

export type TodoRow = typeof todos.$inferSelect;
