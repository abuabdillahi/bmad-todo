import type { Todo } from '@todo/contract';
import { createTodosStore, selectListState, type TodosSnapshot } from './store.ts';

const todo: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-11-25T10:00:00.000Z',
};

function snapshot(patch: Partial<TodosSnapshot>): TodosSnapshot {
  return { loaded: false, lastFetchFailure: null, retryRequested: false, pendingCount: 0, revertedAt: new Map(), ...patch };
}

describe('todos store', () => {
  it.each<[string, Partial<TodosSnapshot>, Todo[] | undefined, string]>([
    ['not loaded, no failure', {}, undefined, 'loading'],
    ['not loaded, failed', { lastFetchFailure: 'network' }, undefined, 'error'],
    ['not loaded, failed, retry requested', { lastFetchFailure: 'network', retryRequested: true }, undefined, 'loading'],
    ['not loaded, an optimistic add cached', { }, [todo], 'loading'],
    ['not loaded, failed, an optimistic add cached', { lastFetchFailure: 'unavailable' }, [todo], 'error'],
    ['loaded, todos cached', { loaded: true }, [todo], 'populated'],
    ['loaded, nothing cached', { loaded: true }, [], 'empty'],
    ['loaded, cache missing', { loaded: true }, undefined, 'empty'],
    ['loaded, and the last fetch failed', { loaded: true, lastFetchFailure: 'generic' }, [todo], 'populated'],
  ])('K7 selects the list state: %s', (_name, patch, cached, expected) => {
    expect(selectListState(snapshot(patch), cached)).toBe(expected);
  });

  it('K7 a fetch failure records its kind, replaces an earlier one and clears the retry', () => {
    const store = createTodosStore();
    store.recordFetchFailure('network');
    store.requestRetry();
    expect(store.getSnapshot()).toMatchObject({ lastFetchFailure: 'network', retryRequested: true, loaded: false });
    store.recordFetchFailure('unavailable');
    expect(store.getSnapshot()).toMatchObject({ lastFetchFailure: 'unavailable', retryRequested: false, loaded: false });
  });

  it('K7 a fetch success sets loaded and clears the failure and the retry', () => {
    const store = createTodosStore();
    store.recordFetchFailure('network');
    store.requestRetry();
    store.recordFetchSuccess();
    expect(store.getSnapshot()).toMatchObject({ loaded: true, lastFetchFailure: null, retryRequested: false });
    store.recordFetchFailure('generic');
    expect(store.getSnapshot()).toMatchObject({ loaded: true, lastFetchFailure: 'generic' });
  });

  it('K7 counts pending mutations and never goes below zero', () => {
    const store = createTodosStore();
    store.mutationStarted();
    store.mutationStarted();
    store.mutationSettled();
    expect(store.getSnapshot().pendingCount).toBe(1);
    store.mutationSettled();
    store.mutationSettled();
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('K7 records reverts in a new map, leaving the old snapshot unchanged', () => {
    const store = createTodosStore();
    const before = store.getSnapshot();
    store.recordRevert(todo.id, 100);
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(before.revertedAt.size).toBe(0);
    expect(after.revertedAt.get(todo.id)).toBe(100);
  });

  it('K7 notifies on change only, with a new snapshot each time', () => {
    const store = createTodosStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const first = store.getSnapshot();
    store.recordFetchSuccess();
    expect(store.getSnapshot()).not.toBe(first);
    const second = store.getSnapshot();
    store.recordFetchSuccess();
    expect(store.getSnapshot()).toBe(second);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.recordFetchFailure('network');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
