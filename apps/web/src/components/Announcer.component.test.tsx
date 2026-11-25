import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { Todo } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { renderApp } from '../../test/render.tsx';
import { useAnnouncer, useTodosStore } from '../todos/hooks.ts';
import { todosQueryKey } from '../todos/query.ts';
import type { TodosSnapshot } from '../todos/store.ts';

const REFRESH = "Couldn't refresh the list. You're seeing what was last loaded.";
const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
const NETWORK = 'Check your connection and try again.';
const GENERIC = 'Something went wrong on our side. Try again.';

const todo: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Already here',
  completed: false,
  createdAt: '2026-11-23T10:00:00.000Z',
};

/** AD-4's literal nginx body, as the API answers it, with a charset. */
const unavailableProblem = () =>
  HttpResponse.json(
    {
      type: '/problems/unavailable',
      title: 'Service unavailable',
      status: 503,
      detail: 'The service is unavailable. Try again shortly.',
    },
    { status: 503, headers: { 'Content-Type': 'application/problem+json; charset=utf-8' } },
  );

type Answer = () => Response | Promise<Response>;

/** GET /api/todos answers from a queue; the last answer repeats. Counts the requests. */
function serveLists(...answers: Answer[]) {
  const calls = { count: 0 };
  server.use(
    http.get('*/api/todos', () => {
      const answer = answers[Math.min(calls.count, answers.length - 1)]!;
      calls.count += 1;
      return answer();
    }),
  );
  return calls;
}

const listed: Answer = () => HttpResponse.json([todo]);

/** The Announcer's live element: the status outside the add form. */
function liveElement(): HTMLElement {
  const statuses = screen.getAllByRole('status').filter((el) => el.closest('form') === null);
  expect(statuses).toHaveLength(1);
  return statuses[0]!;
}

async function settled(queryClient: ReturnType<typeof renderApp>['queryClient']) {
  await waitFor(() => expect(queryClient.getQueryState(todosQueryKey)?.fetchStatus).toBe('idle'));
}

/** A focus refetch, the way TanStack sees the tab regain focus. */
async function regainFocus() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

async function renderLoaded(...later: Answer[]) {
  const calls = serveLists(listed, ...later);
  const app = renderApp();
  await waitFor(() => expect(within(app.list).getAllByRole('listitem')).toHaveLength(1));
  await settled(app.queryClient);
  return { ...app, calls };
}

afterEach(() => {
  focusManager.setFocused(undefined);
});

describe('Announcer: refresh failures', () => {
  it('K7 a focus refetch answering a 503 problem keeps the list and announces refresh plus the unavailable reason', async () => {
    const { list, calls, queryClient } = await renderLoaded(unavailableProblem);
    expect(liveElement().textContent).toBe('');

    await regainFocus();
    await waitFor(() => expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`));
    await settled(queryClient);

    expect(calls.count).toBe(2);
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Already here']);
    expect(liveElement().getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it.each([
    ['a network failure', () => HttpResponse.error(), NETWORK],
    ['an HTML 502', () => new HttpResponse('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }), GENERIC],
  ])('K7 %s gives its reason', async (_name, answer, reason) => {
    const { list } = await renderLoaded(answer);

    await regainFocus();
    await waitFor(() => expect(liveElement().textContent).toBe(`${REFRESH} ${reason}`));
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('K7 a first-load failure announces nothing', async () => {
    const calls = serveLists(unavailableProblem);
    let snapshot: TodosSnapshot | undefined;
    function Probe() {
      snapshot = useTodosStore();
      return null;
    }
    const { queryClient } = renderApp({ children: <Probe /> });

    await waitFor(() => expect(calls.count).toBe(1));
    await settled(queryClient);
    expect(snapshot).toMatchObject({ loaded: false, lastFetchFailure: 'unavailable' });
    expect(liveElement().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('K7 an aborted fetch records nothing and announces nothing', async () => {
    let release: () => void = () => {};
    const held: Answer = () => new Promise<Response>((resolve) => (release = () => resolve(unavailableProblem())));
    let snapshot: TodosSnapshot | undefined;
    function Probe() {
      snapshot = useTodosStore();
      return null;
    }
    serveLists(listed, held);
    const app = renderApp({ children: <Probe /> });
    await waitFor(() => expect(within(app.list).getAllByRole('listitem')).toHaveLength(1));
    await settled(app.queryClient);
    const before = snapshot;

    await regainFocus();
    await waitFor(() => expect(app.queryClient.getQueryState(todosQueryKey)?.fetchStatus).toBe('fetching'));
    await act(() => app.queryClient.cancelQueries({ queryKey: todosQueryKey }));
    release();
    await settled(app.queryClient);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(snapshot).toBe(before);
    expect(snapshot).toMatchObject({ loaded: true, lastFetchFailure: null });
    expect(liveElement().textContent).toBe('');
    expect(within(app.list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('K7 the same refresh failure again is not set again', async () => {
    const { calls, queryClient } = await renderLoaded(unavailableProblem);
    await regainFocus();
    await waitFor(() => expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`));
    await settled(queryClient);

    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => changes.push(...records));
    observer.observe(liveElement(), { childList: true, characterData: true, subtree: true });
    await regainFocus();
    await waitFor(() => expect(calls.count).toBe(3));
    await settled(queryClient);
    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.disconnect();

    expect(changes).toEqual([]);
    expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`);
  });

  it('K7 an undismissed failure is not replaced by a refresh, which is dropped', async () => {
    let announce: ReturnType<typeof useAnnouncer>['announce'] = () => {};
    function Caller() {
      announce = useAnnouncer().announce;
      return null;
    }
    const calls = serveLists(listed, unavailableProblem);
    const { list, queryClient } = renderApp({ children: <Caller /> });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    await settled(queryClient);

    act(() => announce('failure', 'Couldn’t add a thing.'));
    expect(liveElement().textContent).toBe('Couldn’t add a thing.');

    await regainFocus();
    await waitFor(() => expect(calls.count).toBe(2));
    await settled(queryClient);
    expect(liveElement().textContent).toBe('Couldn’t add a thing.');

    // Dropped, not queued: dismissing shows nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(liveElement().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('K7 a later successful fetch recovers and keeps the message until dismissed', async () => {
    let snapshot: TodosSnapshot | undefined;
    function Probe() {
      snapshot = useTodosStore();
      return null;
    }
    const calls = serveLists(listed, unavailableProblem, listed);
    const { list, queryClient } = renderApp({ children: <Probe /> });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    await settled(queryClient);

    await regainFocus();
    await waitFor(() => expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`));
    await settled(queryClient);
    expect(snapshot).toMatchObject({ loaded: true, lastFetchFailure: 'unavailable' });

    await regainFocus();
    await waitFor(() => expect(calls.count).toBe(3));
    await settled(queryClient);
    expect(snapshot).toMatchObject({ loaded: true, lastFetchFailure: null, retryRequested: false });
    expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`);
  });
});

describe('Announcer: Dismiss', () => {
  async function renderWithRefreshFailure() {
    const app = await renderLoaded(unavailableProblem);
    await regainFocus();
    await waitFor(() => expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`));
    await settled(app.queryClient);
    return app;
  }

  /** Records document.activeElement whenever the region's children change, to catch a drop to <body>. */
  function watchFocusDuringRemoval() {
    const seen: (Element | null)[] = [];
    const region = liveElement().parentElement!;
    const observer = new MutationObserver(() => seen.push(document.activeElement));
    observer.observe(region, { childList: true, subtree: true });
    return { seen, stop: () => observer.disconnect() };
  }

  it('K6 the live element is always mounted, holds only the text, and the icon is hidden', async () => {
    const { queryClient } = await renderLoaded(unavailableProblem);
    expect(liveElement().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();

    await regainFocus();
    await waitFor(() => expect(liveElement().textContent).toBe(`${REFRESH} ${UNAVAILABLE}`));
    await settled(queryClient);
    const live = liveElement();
    expect(live.children).toHaveLength(0);
    expect(live.closest('[aria-hidden], [hidden], [inert]')).toBeNull();
    const region = live.parentElement!;
    expect(region.parentElement?.tagName).toBe('MAIN');
    expect(region.parentElement?.firstElementChild).toBe(region);
    const hidden = region.querySelectorAll('[aria-hidden="true"]');
    expect([...hidden].map((el) => el.textContent)).toEqual(['!']);
    expect(live.contains(screen.getByRole('button', { name: 'Dismiss' }))).toBe(false);
  });

  it('K6 Dismiss is named "Dismiss", is the first tab stop, and Enter clears it with focus in the add field', async () => {
    const { user, field } = await renderWithRefreshFailure();
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });

    (document.activeElement as HTMLElement | null)?.blur();
    await user.tab();
    expect(document.activeElement).toBe(dismiss);

    const watch = watchFocusDuringRemoval();
    await user.keyboard('{Enter}');
    watch.stop();

    expect(liveElement().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(document.activeElement).toBe(field);
    expect(watch.seen.length).toBeGreaterThan(0);
    expect(watch.seen).not.toContain(document.body);
  });

  it('K6 Space on Dismiss clears it with focus in the add field', async () => {
    const { user, field } = await renderWithRefreshFailure();
    screen.getByRole('button', { name: 'Dismiss' }).focus();

    await user.keyboard(' ');

    expect(liveElement().textContent).toBe('');
    expect(document.activeElement).toBe(field);
  });

  it('K6 a click on Dismiss clears it with focus in the add field, never on <body>', async () => {
    const { user, field } = await renderWithRefreshFailure();

    const watch = watchFocusDuringRemoval();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    watch.stop();

    expect(liveElement().textContent).toBe('');
    expect(document.activeElement).toBe(field);
    expect(watch.seen).not.toContain(document.body);
  });

  it('K6 after a touch pointerdown, Dismiss sends focus to the heading without scrolling', async () => {
    const { heading } = await renderWithRefreshFailure();
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    const focus = vi.spyOn(heading, 'focus');

    fireEvent.pointerDown(dismiss, { pointerType: 'touch' });
    fireEvent.click(dismiss);

    expect(liveElement().textContent).toBe('');
    expect(document.activeElement).toBe(heading);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('K6 a keyboard press after an earlier touch goes to the add field', async () => {
    const { user, field } = await renderWithRefreshFailure();
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });

    fireEvent.pointerDown(dismiss, { pointerType: 'touch' });
    dismiss.focus();
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(field);
  });
});
