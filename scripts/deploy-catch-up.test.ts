import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEPLOY_JOB,
  MAX_PAGES,
  START_STEP,
  TEST_JOB,
  cancelledByGroup,
  decide,
  gatherFacts,
  hasSkipToken,
  main,
  realGit,
  summariseRun,
} from './deploy-catch-up.mjs';

const sha = (c: string) => c.repeat(40);
const D = sha('b'); // what production runs
const C = sha('c'); // a code commit after D
const K = sha('d'); // a [skip ci] bookkeeping commit after C
const T = sha('a'); // main's tip
const N = sha('e'); // a commit newer than T
const X = sha('f'); // a commit on another line of history
const RUN_ID = 900; // the current scheduled run

type Commit = { sha: string; message: string; date?: string };

/** A fake git over one first-parent line, oldest first; X is on another line. */
function makeGit(line: Commit[]) {
  const shas = line.map((c) => c.sha);
  return {
    isCommit: (s: string) => shas.includes(s) || s === X,
    isAncestor: (a: string, b: string) => shas.includes(a) && shas.includes(b) && shas.indexOf(a) <= shas.indexOf(b),
    firstParentLog: (from: string, to: string) =>
      line
        .slice(shas.indexOf(from) + 1, shas.indexOf(to) + 1)
        .reverse()
        .map(({ sha: s, message }) => ({ sha: s, message })),
    committerDate: (s: string) => line.find((c) => c.sha === s)?.date ?? at(-60),
  };
}

/** D, then T, a code commit, then N. */
const simple = makeGit([
  { sha: D, message: 'production\n' },
  { sha: T, message: 'Merge pull request #1\n' },
  { sha: N, message: 'newer\n' },
]);
/** D, code commit C, then two bookkeeping commits K and T. */
const bookkept = makeGit([
  { sha: D, message: 'production\n' },
  { sha: C, message: 'Merge pull request #2\n' },
  { sha: K, message: 'Close 2.8 [skip ci]\n' },
  { sha: T, message: 'Start 2.9\n\nskip-checks: true\n' },
]);

/** Minutes after 10:00 on 2026-11-25, as the API's created_at. */
function at(minutes: number) {
  return new Date(Date.UTC(2026, 10, 25, 10, 0) + minutes * 60_000).toISOString().replace('.000', '');
}

type Step = { name: string; status: string; conclusion: string | null };
type Job = { id?: number; name: string; status: string; conclusion: string | null; steps?: Step[] };

function job(name: string, conclusion: string | null, steps?: Step[]): Job {
  return { name, status: conclusion === null ? 'in_progress' : 'completed', conclusion, steps };
}

const started: Step = { name: 'Start production', status: 'completed', conclusion: 'success' };
const guardSkipped: Step = { name: 'Start production', status: 'completed', conclusion: 'skipped' };
const GROUP = "Canceling since a higher priority waiting request for 'deploy-prod' exists";
const MASKED = "Canceling since a higher priority waiting request for '***-prod' exists";

/** What a run did: its run status and conclusion, its latest attempt's jobs, the deploy job's annotations. */
const KINDS = {
  running: { status: 'in_progress', conclusion: null, jobs: [] },
  queued: { status: 'queued', conclusion: null, jobs: [] },
  noop: { conclusion: 'success', jobs: [job('catch-up', 'success'), job('test', 'skipped'), job('deploy', 'skipped')] },
  catchUpFailed: { conclusion: 'failure', jobs: [job('catch-up', 'failure'), job('test', 'skipped'), job('deploy', 'skipped')] },
  catchUpCancelled: { conclusion: 'cancelled', jobs: [job('catch-up', 'cancelled'), job('test', 'skipped'), job('deploy', 'skipped')] },
  red: { conclusion: 'failure', jobs: [job('test', 'failure'), job('deploy', 'skipped')] },
  timedOut: { conclusion: 'failure', jobs: [job('test', 'timed_out'), job('deploy', 'skipped')] },
  deployed: { conclusion: 'success', jobs: [job('test', 'success'), job('deploy', 'success', [started])] },
  guardSkipped: { conclusion: 'success', jobs: [job('test', 'success'), job('deploy', 'success', [guardSkipped])] },
  deployFailed: { conclusion: 'failure', jobs: [job('test', 'success'), job('deploy', 'failure')] },
  group: { conclusion: 'cancelled', jobs: [job('test', 'success'), job('deploy', 'cancelled')], annotations: [{ message: GROUP }] },
  masked: { conclusion: 'cancelled', jobs: [job('test', 'success'), job('deploy', 'cancelled')], annotations: [{ message: MASKED }] },
  person: {
    conclusion: 'cancelled',
    jobs: [job('test', 'success'), job('deploy', 'cancelled')],
    annotations: [{ message: 'The operation was canceled.' }],
  },
  bare: { conclusion: 'cancelled', jobs: [job('test', 'success'), job('deploy', 'cancelled')], annotations: [] },
  testCancelled: { conclusion: 'cancelled', jobs: [job('test', 'cancelled'), job('deploy', 'skipped')] },
} as const;
type Kind = keyof typeof KINDS;

type FakeRun = {
  id: number;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  head_sha: string;
  head_branch: string;
  run_started_at?: string;
  kind: Kind;
};

function ghRun(id: number, headSha: string, kind: Kind, minutes: number, overrides: Partial<FakeRun> = {}): FakeRun {
  const k = KINDS[kind];
  return {
    id,
    event: 'push',
    status: 'status' in k ? k.status : 'completed',
    conclusion: k.conclusion,
    created_at: at(minutes),
    html_url: `https://github.example/runs/${id}`,
    head_sha: headSha,
    head_branch: 'main',
    kind,
    ...overrides,
  };
}
const push = (id: number, s: string, kind: Kind, minutes: number, o: Partial<FakeRun> = {}) => ghRun(id, s, kind, minutes, o);
const scheduled = (id: number, s: string, kind: Kind, minutes: number) => ghRun(id, s, kind, minutes, { event: 'schedule' });
const dispatch = (id: number, minutes: number, o: Partial<FakeRun> = {}) =>
  ghRun(id, T, 'deployed', minutes, { event: 'workflow_dispatch', ...o });

const STATUSES = ['completed', 'in_progress', 'queued', 'requested', 'waiting', 'pending', 'action_required'];

/**
 * A fake GitHub API for ci.yml: honours the runs list's event, branch,
 * head_sha, status, per_page and page; serves each run's jobs and the deploy
 * job's annotations; records every call.
 */
function fakeGitHub(runs: FakeRun[], options: { fail?: (path: string) => boolean; raw?: Record<string, unknown> } = {}) {
  const calls: string[] = [];
  const jobsOf = (run: FakeRun) => KINDS[run.kind].jobs.map((j, i) => ({ ...j, id: run.id * 10 + i }));
  const api = async (path: string) => {
    calls.push(path);
    if (options.fail?.(path)) throw new Error(`GET ${path}: 500 Internal Server Error`);
    if (options.raw && path in options.raw) return options.raw[path];
    const [base, query = ''] = path.split('?');
    const q = new URLSearchParams(query);
    if (base === '/actions/workflows/ci.yml/runs') {
      const status = q.get('status');
      const matching = runs
        .filter((r) => !q.has('event') || r.event === q.get('event'))
        .filter((r) => !q.has('branch') || r.head_branch === q.get('branch'))
        .filter((r) => !q.has('head_sha') || r.head_sha === q.get('head_sha'))
        .filter((r) => !status || (STATUSES.includes(status) ? r.status === status : r.conclusion === status))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const perPage = Number(q.get('per_page') ?? 30);
      const page = Number(q.get('page') ?? 1);
      const workflow_runs = matching.slice((page - 1) * perPage, page * perPage).map(({ kind: _kind, ...r }) => r);
      return { total_count: matching.length, workflow_runs };
    }
    const jobs = /^\/actions\/runs\/(\d+)\/jobs$/.exec(base ?? '');
    const run = jobs && runs.find((r) => r.id === Number(jobs[1]));
    if (run) return { total_count: KINDS[run.kind].jobs.length, jobs: jobsOf(run) };
    const annotations = /^\/check-runs\/(\d+)\/annotations$/.exec(base ?? '');
    const owner = annotations && runs.find((r) => jobsOf(r).some((j) => j.id === Number(annotations[1])));
    if (owner) {
      const k = KINDS[owner.kind];
      return 'annotations' in k ? k.annotations : [];
    }
    throw new Error(`GET ${path}: 404 Not Found`);
  };
  return { api, calls };
}

/** gatherFacts then decide, for the tip T. */
async function check(runs: FakeRun[], git = simple, deployed = D, options = {}) {
  const gh = fakeGitHub(runs, options);
  const facts = await gatherFacts({ tip: T, deployed, runId: RUN_ID, git, api: gh.api });
  return { facts, decision: decide(facts), calls: gh.calls };
}

const runsPath = '/actions/workflows/ci.yml/runs';
const jobsCalls = (calls: string[]) => calls.filter((c) => c.includes('/jobs'));

describe('the names the script reads ci.yml by', () => {
  it('are exported for the workflow test to pin', () => {
    expect([TEST_JOB, DEPLOY_JOB, START_STEP]).toEqual(['test', 'deploy', 'Start production']);
  });
});

describe('hasSkipToken', () => {
  it.each([
    ['Close 2.8 [skip ci]'],
    ['[ci skip] board'],
    ['tidy [no ci]'],
    ['notes [skip actions]'],
    ['notes [actions skip]'],
    ['Subject\n\nBody line\n[skip ci]\n'],
    ['Subject\n\nskip-checks: true\n'],
    ['Subject\n\nskip-checks:true'],
  ])('%j skips CI', (message) => {
    expect(hasSkipToken(message)).toBe(true);
  });

  it.each([
    ['Merge pull request #63'],
    ['skip ci without brackets'],
    ['[skip-ci]'],
    ['Subject\n\nskip-checks: false\n'],
    ['Subject\n\nnot a trailer skip-checks: true\n'],
  ])('%j does not', (message) => {
    expect(hasSkipToken(message)).toBe(false);
  });
});

describe('cancelledByGroup', () => {
  it.each([
    ["the group's message", [{ message: GROUP }], true],
    ['the message with the group name masked', [{ message: MASKED }], true],
    ['the message in the title', [{ title: GROUP, message: '' }], true],
    ["a person's cancel", [{ message: 'The operation was canceled.' }], false],
    ['another group', [{ message: "Canceling since a higher priority waiting request for 'other' exists" }], false],
    ['no annotations', [], false],
  ])('%s', (_title, annotations, expected) => {
    expect(cancelledByGroup(annotations)).toBe(expected);
  });
});

describe('summariseRun', () => {
  const completed = { id: 1, event: 'push', status: 'completed', conclusion: 'success', created_at: at(0), html_url: '' };
  it.each([
    ['a run not completed is in progress', { ...completed, status: 'in_progress' }, [], [], 'in-progress'],
    ['a queued run is in progress', { ...completed, status: 'queued' }, [], [], 'in-progress'],
    ['a failed test is red', completed, KINDS.red.jobs, [], 'red'],
    ['a timed-out test is red', completed, KINDS.timedOut.jobs, [], 'red'],
    ['a cancelled test is a deliberate cancel', completed, KINDS.testCancelled.jobs, [{ message: GROUP }], 'cancelled'],
    ['a skipped test is not attempted', completed, KINDS.noop.jobs, [], 'not-attempted'],
    ['a run with no jobs is not attempted', completed, [], [], 'not-attempted'],
    ['a deploy that started production is deployed', completed, KINDS.deployed.jobs, [], 'deployed'],
    ['a deploy whose guard skipped "Start production" is not attempted', completed, KINDS.guardSkipped.jobs, [], 'not-attempted'],
    ['a failed deploy is deploy-failed', completed, KINDS.deployFailed.jobs, [], 'deploy-failed'],
    ['a timed-out deploy is deploy-failed', completed, [job('test', 'success'), job('deploy', 'timed_out')], [], 'deploy-failed'],
    ['a deploy the group cancelled', completed, KINDS.group.jobs, [{ message: GROUP }], 'cancelled-by-group'],
    ['a deploy the group cancelled, masked', completed, KINDS.group.jobs, [{ message: MASKED }], 'cancelled-by-group'],
    ['a deploy a person cancelled', completed, KINDS.person.jobs, [{ message: 'The operation was canceled.' }], 'cancelled'],
    ['a cancelled deploy with no annotations', completed, KINDS.bare.jobs, [], 'cancelled'],
    ['a green branch push (deploy skipped) is not attempted', completed, [job('test', 'success'), job('deploy', 'skipped')], [], 'not-attempted'],
    ['a green test with no deploy job is not attempted', completed, [job('test', 'success')], [], 'not-attempted'],
  ])('%s', (_title, run, jobs, annotations, expected) => {
    expect(summariseRun(run, [...jobs], annotations)).toBe(expected);
  });
});

describe('decide: the effective matrix', () => {
  const base = {
    tip: T,
    deployed: D,
    rawDeployed: D,
    relation: 'tip-newer',
    candidate: T,
    pushRunsOfCandidate: 1,
    running: null,
    rollback: null,
    newest: null,
  };
  const facts = (o: Record<string, unknown>) => ({ ...base, ...o });
  const newest = (outcome: string) => ({ id: 7, url: 'https://github.example/runs/7', outcome });

  it.each([
    ['1 Equal', facts({ deployed: T, rawDeployed: T, relation: 'equal' }), false, 'notice', `Production already runs main's tip ${T}`],
    ['2 Tip older', facts({ deployed: N, rawDeployed: N, relation: 'tip-older' }), false, 'notice', `Production runs ${N}, which is newer`],
    ['3 Unrelated', facts({ deployed: X, rawDeployed: X, relation: 'unrelated' }), false, 'warning', 'neither older nor newer'],
    ['3 None running', facts({ deployed: '', rawDeployed: '', relation: 'unknown' }), false, 'warning', 'no api container'],
    ['3 Not a SHA', facts({ deployed: '', rawDeployed: 'latest', relation: 'unknown' }), false, 'warning', 'image tag "latest" is not a commit'],
    ['4 Only skip-token commits', facts({ candidate: null }), false, 'notice', `every commit after it up to main's tip ${T} skips CI`],
    ['5 In progress', facts({ running: { id: 3, url: 'https://github.example/runs/3' } }), false, 'notice', 'runs/3 for main'],
    [
      '6 Rolled back',
      facts({ rollback: { id: 5, url: 'https://github.example/runs/5', createdAt: at(30) } }),
      false,
      'notice',
      'until the next push',
    ],
    ['7 Red', facts({ newest: newest('red') }), false, 'notice', 'failed its tests in run https://github.example/runs/7'],
    ['8 Deployed before', facts({ newest: newest('deployed') }), false, 'warning', 'changed by hand'],
    ['9 Deploy failed', facts({ newest: newest('deploy-failed') }), false, 'warning', 'A person re-runs it'],
    ['10 Cancelled by the group', facts({ newest: newest('cancelled-by-group') }), true, 'notice', `Testing and deploying ${T}`],
    ['11 Cancelled on purpose', facts({ newest: newest('cancelled') }), false, 'notice', 'cancelled in run https://github.example/runs/7'],
    ['12 No run', facts({ pushRunsOfCandidate: 0 }), true, 'notice', `No push to main ran CI for main's tip ${T}`],
    ['13 Runs, none attempted', facts({ pushRunsOfCandidate: 1 }), false, 'warning', 'moved off it some other way'],
  ])('%s', (_title, given, deploy, level, reason) => {
    const decision = decide(given);
    expect(decision).toMatchObject({ deploy, level });
    expect(decision.reason).toContain(reason);
  });

  it('names the candidate and deploys the tip when the tip is a bookkeeping commit', () => {
    const { deploy, reason } = decide(facts({ candidate: C, pushRunsOfCandidate: 0 }));
    expect(deploy).toBe(true);
    expect(reason).toContain(`${C} (the newest commit under main's tip ${T} that does not skip CI)`);
    expect(reason).toContain(`Testing and deploying ${T}`);
  });

  it('prints an odd image tag only in a safe form', () => {
    const { reason } = decide(facts({ deployed: '', rawDeployed: 'x\n::error::boom %0A', relation: 'unknown' }));
    expect(reason).toContain('"x???error??boom??0A"');
  });

  it('names the tip in every reason', () => {
    for (const relation of ['equal', 'tip-older', 'unrelated', 'unknown']) {
      expect(decide(facts({ relation })).reason).toContain(T);
    }
  });
});

describe('gatherFacts and decide', () => {
  describe('rows 1-4 read no API', () => {
    it.each([
      ['equal', T, 'equal', T],
      ['tip older', N, 'tip-older', N],
      ['unrelated', X, 'unrelated', X],
      ['empty', '', 'unknown', ''],
      ['not 40-hex', 'latest', 'unknown', ''],
      ['unknown to git', sha('9'), 'unknown', ''],
    ])('%s', async (_title, deployed, relation, validated) => {
      const { facts, calls } = await check([], simple, deployed);
      expect(facts).toMatchObject({ relation, deployed: validated, rawDeployed: deployed });
      expect(calls).toEqual([]);
    });

    it('every commit since production skips CI: no deploy', async () => {
      const onlyBookkeeping = makeGit([
        { sha: D, message: 'production\n' },
        { sha: K, message: 'Close 2.8 [skip ci]\n' },
        { sha: T, message: 'Start 2.9 [ci skip]\n' },
      ]);
      const { facts, decision, calls } = await check([], onlyBookkeeping);
      expect(facts).toMatchObject({ relation: 'tip-newer', candidate: null });
      expect(decision).toMatchObject({ deploy: false, level: 'notice' });
      expect(calls).toEqual([]);
    });
  });

  describe('row 5: a run still going', () => {
    it("C's push run in progress, under bookkeeping commits", async () => {
      const { facts, decision } = await check([push(1, C, 'running', 0)], bookkept);
      expect(facts.candidate).toBe(C);
      expect(decision).toMatchObject({ deploy: false, level: 'notice' });
      expect(decision.reason).toContain('runs/1');
    });

    it("a scheduled run of a bookkeeping commit above C, still testing", async () => {
      const runs = [push(1, C, 'group', 0), scheduled(2, K, 'running', 20), scheduled(3, T, 'noop', 50)];
      const { decision } = await check(runs, bookkept);
      expect(decision).toMatchObject({ deploy: false });
      expect(decision.reason).toContain('runs/2');
    });

    it('a queued push run counts too', async () => {
      expect((await check([push(1, T, 'queued', 0)])).decision.reason).toContain('runs/1');
    });

    it('the current run does not count', async () => {
      const runs = [push(1, T, 'group', 0), scheduled(RUN_ID, T, 'running', 60)];
      expect((await check(runs)).decision).toMatchObject({ deploy: true });
    });

    it('a run by hand on main still going (a rollback) counts, before any other', async () => {
      const runs = [push(1, T, 'group', 0), dispatch(7, 20, { status: 'in_progress', conclusion: null })];
      const { facts, decision } = await check(runs);
      expect(facts.running).toEqual({ id: 7, url: 'https://github.example/runs/7', byHand: true });
      expect(decision).toMatchObject({ deploy: false, level: 'notice' });
      expect(decision.reason).toContain('A run by hand (https://github.example/runs/7) is still in progress on main');
    });

    it('a run by hand on another branch still going does not count', async () => {
      const runs = [push(1, T, 'group', 0), dispatch(7, 20, { status: 'in_progress', conclusion: null, head_branch: 'x' })];
      expect((await check(runs)).decision).toMatchObject({ deploy: true });
    });

    it('a branch push run of the tip does not count', async () => {
      const runs = [push(1, T, 'group', 0), push(2, T, 'running', 5, { head_branch: 'story-x' })];
      expect((await check(runs)).decision).toMatchObject({ deploy: true });
    });

    it('a branch run the API returned anyway is filtered out', async () => {
      const path = `${runsPath}?event=push&branch=main&head_sha=${T}&per_page=100`;
      const branchRun = push(2, T, 'running', 5, { head_branch: 'story-x' });
      const { decision } = await check([], simple, D, { raw: { [path]: { workflow_runs: [branchRun] } } });
      expect(decision).toMatchObject({ deploy: true });
      expect(decision.reason).toContain('No push to main ran CI');
    });
  });

  describe('row 6: a deploy by hand after C landed', () => {
    it("counts from C's earliest main push run", async () => {
      const runs = [push(1, T, 'group', 0), push(2, T, 'testCancelled', 30), dispatch(8, 5), dispatch(7, -5)];
      const { facts, decision } = await check(runs);
      expect(facts.rollback).toEqual({ id: 8, url: 'https://github.example/runs/8', createdAt: at(5) });
      expect(decision).toMatchObject({ deploy: false, level: 'notice' });
    });

    it('a deploy by hand before C landed does not count', async () => {
      const { facts, decision } = await check([push(1, T, 'group', 0), dispatch(7, -5)]);
      expect(facts.rollback).toBeNull();
      expect(decision).toMatchObject({ deploy: true });
    });

    it('a branch push of C before it reached main does not set the landing time', async () => {
      const runs = [push(1, T, 'group', 0), push(2, T, 'red', -30, { head_branch: 'story-x' }), dispatch(7, -10)];
      const { facts } = await check(runs);
      expect(facts.rollback).toBeNull();
    });

    it("with no main push run, C's committer date", async () => {
      const dated = makeGit([
        { sha: D, message: 'production\n' },
        { sha: T, message: 'Merge\n', date: at(-60) },
      ]);
      expect((await check([dispatch(7, -30)], dated)).decision).toMatchObject({ deploy: false, level: 'notice' });
      expect((await check([dispatch(7, -90)], dated)).decision).toMatchObject({ deploy: true });
    });

    it('a failed dispatch, or one on another branch, does not count', async () => {
      const runs = [push(1, T, 'group', 0), dispatch(7, 10, { kind: 'deployFailed', conclusion: 'failure' }), dispatch(8, 10, { head_branch: 'x' })];
      expect((await check(runs)).facts.rollback).toBeNull();
    });
  });

  describe('rows 7-11: the newest attempted run', () => {
    it.each([
      ['red', 'red', false, 'notice'],
      ['timed-out test', 'timedOut', false, 'notice'],
      ['deployed before', 'deployed', false, 'warning'],
      ['deploy failed', 'deployFailed', false, 'warning'],
      ['cancelled by the group', 'group', true, 'notice'],
      ['cancelled by the group, masked', 'masked', true, 'notice'],
      ["a person's cancel", 'person', false, 'notice'],
      ['a cancel with no annotations', 'bare', false, 'notice'],
      ['a cancelled test', 'testCancelled', false, 'notice'],
    ] as const)("C's push run: %s", async (_title, kind, deploy, level) => {
      const { decision } = await check([push(1, T, kind, 0)]);
      expect(decision).toMatchObject({ deploy, level });
      expect(decision.reason).toContain('runs/1');
    });

    it.each([
      ['red', 'red', false],
      ['deploy failed', 'deployFailed', false],
      ['cancelled by the group', 'group', true],
      ["a person's cancel", 'person', false],
    ] as const)('a scheduled run of a bookkeeping commit: %s', async (_title, kind, deploy) => {
      const runs = [push(1, C, 'guardSkipped', 0), scheduled(2, K, kind, 30)];
      const { decision } = await check(runs, bookkept);
      expect(decision).toMatchObject({ deploy });
      expect(decision.reason).toContain('runs/2');
    });

    it('a scheduled run that concluded timed_out is read too, so a timed-out tip is not re-tested', async () => {
      const timedOut = { ...scheduled(2, T, 'timedOut', 30), conclusion: 'timed_out' };
      const { decision } = await check([push(1, T, 'group', 0), timedOut]);
      expect(decision).toMatchObject({ deploy: false });
      expect(decision.reason).toContain('failed its tests in run https://github.example/runs/2');
    });

    it('a newer scheduled run decides over an older push run, both ways', async () => {
      expect((await check([push(1, T, 'red', 0), scheduled(2, T, 'group', 30)])).decision.deploy).toBe(true);
      expect((await check([push(1, T, 'group', 0), scheduled(2, T, 'red', 30)])).decision.deploy).toBe(false);
      expect((await check([push(1, T, 'group', 0), scheduled(2, T, 'person', 30)])).decision.deploy).toBe(false);
    });

    it("a deliberate cancel quotes the deploy job's annotation, so a person can see why it was not the group's", async () => {
      const { decision } = await check([push(1, T, 'person', 0)]);
      expect(decision).toMatchObject({ deploy: false, level: 'notice' });
      expect(decision.reason).toContain(`The cancelled deploy's annotation: "The operation was canceled.".`);
      expect((await check([push(1, T, 'bare', 0)])).decision.reason).not.toContain('annotation');
    });

    it('orders runs by their latest attempt, so a re-run decides over a newer-created run', async () => {
      const rerun = push(1, T, 'group', 0, { run_started_at: at(90) } as Partial<FakeRun>);
      expect((await check([rerun, scheduled(2, T, 'red', 30)])).decision).toMatchObject({ deploy: true });
      expect((await check([push(1, T, 'group', 0), scheduled(2, T, 'red', 30)])).decision).toMatchObject({ deploy: false });
    });

    it('a cancelled deploy reads annotations; other runs do not', async () => {
      const { calls } = await check([push(1, T, 'group', 0)]);
      expect(calls.filter((c) => c.includes('/annotations'))).toEqual(['/check-runs/11/annotations?per_page=100']);
      const red = await check([push(1, T, 'red', 0)]);
      expect(red.calls.some((c) => c.includes('/annotations'))).toBe(false);
    });

    it('stops reading jobs at the first attempted run', async () => {
      const runs = [push(1, T, 'red', 0), push(2, T, 'group', 10), scheduled(3, T, 'catchUpFailed', 40)];
      const { decision, calls } = await check(runs);
      expect(decision.reason).toContain('runs/2');
      expect(jobsCalls(calls)).toEqual(['/actions/runs/3/jobs?per_page=100', '/actions/runs/2/jobs?per_page=100']);
    });

    it('never reads the jobs of no-op scheduled runs', async () => {
      const noops = Array.from({ length: 150 }, (_, i) => scheduled(100 + i, T, 'noop', 30 + i * 30));
      const { decision, calls } = await check([push(1, T, 'red', 0), ...noops]);
      expect(decision.reason).toContain('failed its tests in run https://github.example/runs/1');
      expect(jobsCalls(calls)).toEqual(['/actions/runs/1/jobs?per_page=100']);
    });
  });

  describe('not attempted runs are ignored', () => {
    it.each([
      ['a scheduled run whose catch-up failed', 'catchUpFailed'],
      ['a scheduled run cancelled before testing', 'catchUpCancelled'],
    ] as const)('%s', async (_title, kind) => {
      const { decision } = await check([push(1, T, 'red', 0), scheduled(2, T, kind, 30)]);
      expect(decision.reason).toContain('runs/1');
    });

    it("a deploy whose guard skipped 'Start production' (raced)", async () => {
      const runs = [push(1, T, 'group', 0), scheduled(2, T, 'guardSkipped', 30)];
      expect((await check(runs)).decision).toMatchObject({ deploy: true });
    });
  });

  describe('rows 12-13: no attempted run', () => {
    it('12: no run on main for the tip: deploy it', async () => {
      const { decision } = await check([push(2, T, 'red', -30, { head_branch: 'story-x' })]);
      expect(decision).toMatchObject({ deploy: true, level: 'notice' });
    });

    it('12: no run for C under bookkeeping commits: deploy the tip', async () => {
      const { facts, decision } = await check([], bookkept);
      expect(facts.candidate).toBe(C);
      expect(decision).toMatchObject({ deploy: true });
      expect(decision.reason).toContain(`Testing and deploying ${T}`);
    });

    it('13: a main push run of C, none attempted: warning, no deploy', async () => {
      const { decision } = await check([push(1, T, 'guardSkipped', 0)]);
      expect(decision).toMatchObject({ deploy: false, level: 'warning' });
    });
  });

  describe('queries', () => {
    it('reads each list by event, branch and exact SHA, from T down to C only', async () => {
      const { calls } = await check([], bookkept);
      expect(calls).toEqual([
        `${runsPath}?event=push&branch=main&head_sha=${C}&per_page=100`,
        `${runsPath}?event=schedule&branch=main&head_sha=${T}&per_page=20`,
        `${runsPath}?event=schedule&branch=main&head_sha=${T}&status=failure&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${T}&status=timed_out&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${T}&status=cancelled&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${K}&per_page=20`,
        `${runsPath}?event=schedule&branch=main&head_sha=${K}&status=failure&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${K}&status=timed_out&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${K}&status=cancelled&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${C}&per_page=20`,
        `${runsPath}?event=schedule&branch=main&head_sha=${C}&status=failure&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${C}&status=timed_out&per_page=100&page=1`,
        `${runsPath}?event=schedule&branch=main&head_sha=${C}&status=cancelled&per_page=100&page=1`,
        `${runsPath}?event=workflow_dispatch&branch=main&per_page=100`,
      ]);
    });

    it('pages through failed scheduled runs to the decisive one', async () => {
      // 150 scheduled runs whose catch-up failed, newer than the red push run.
      const failed = Array.from({ length: 150 }, (_, i) => scheduled(100 + i, T, 'catchUpFailed', 30 + i * 30));
      const { decision, calls } = await check([push(1, T, 'red', 0), ...failed]);
      expect(decision.reason).toContain('runs/1');
      expect(calls).toContain(`${runsPath}?event=schedule&branch=main&head_sha=${T}&status=failure&per_page=100&page=2`);
      expect(calls).not.toContain(`${runsPath}?event=schedule&branch=main&head_sha=${T}&status=failure&per_page=100&page=3`);
    });

    it(`fails closed beyond ${MAX_PAGES} pages of one list`, async () => {
      const failed = Array.from({ length: MAX_PAGES * 100 + 1 }, (_, i) => scheduled(100 + i, T, 'catchUpFailed', 30 + i));
      await expect(check([push(1, T, 'red', 0), ...failed])).rejects.toThrow(`More than ${MAX_PAGES} pages`);
    });

    it.each([
      ['the runs list', (p: string) => p.includes('event=push')],
      ['the scheduled runs', (p: string) => p.includes('status=cancelled')],
      ['the dispatch runs', (p: string) => p.includes('event=workflow_dispatch')],
      ['the jobs', (p: string) => p.includes('/jobs')],
      ['the annotations', (p: string) => p.includes('/annotations')],
    ])('fails closed on an API error reading %s', async (_title, fail) => {
      await expect(check([push(1, T, 'group', 0)], simple, D, { fail })).rejects.toThrow('500');
    });

    it('rejects a tip that is not a commit', async () => {
      const gh = fakeGitHub([]);
      await expect(gatherFacts({ tip: sha('9'), deployed: D, runId: RUN_ID, git: simple, api: gh.api })).rejects.toThrow('not a commit');
    });
  });
});

/** main() against fakes, as a dry run: what it writes and prints. */
function dryRun(env: Record<string, string>, runs: FakeRun[], git = simple, options = {}) {
  const files: Record<string, string> = {};
  const lines: string[] = [];
  const { api } = fakeGitHub(runs, options);
  const deps = {
    git,
    api,
    appendFile: (path: string, text: string) => {
      files[path] = (files[path] ?? '') + text;
    },
    log: (line: string) => lines.push(line),
  };
  const fullEnv = { GITHUB_SHA: T, GITHUB_RUN_ID: String(RUN_ID), GITHUB_OUTPUT: '/out', GITHUB_STEP_SUMMARY: '/summary', ...env };
  return { files, lines, result: main(fullEnv, deps) };
}

describe('main (dry run)', () => {
  it('production on the tip: deploy=false and a "Deploy catch-up" notice naming the tip', async () => {
    const { files, lines, result } = dryRun({ DEPLOYED: T }, []);
    await result;
    expect(files['/out']).toBe(`deploy=false\ndeployed=${T}\n`);
    expect(lines).toEqual([`::notice title=Deploy catch-up::Production already runs main's tip ${T}; nothing to deploy.`]);
    expect(files['/summary']).toBe(`### Deploy catch-up\n\nProduction already runs main's tip ${T}; nothing to deploy.\n`);
  });

  it('production on main\'s code under [skip ci] commits: deploy=false, a notice naming the SHAs', async () => {
    const { files, lines, result } = dryRun({ DEPLOYED: C }, [], bookkept);
    await result;
    expect(files['/out']).toBe(`deploy=false\ndeployed=${C}\n`);
    expect(lines[0]).toMatch(/^::notice title=Deploy catch-up::Production runs c{40}, which is main's code/);
    expect(lines[0]).toContain(T);
  });

  it('a deploy the group cancelled: deploy=true with the validated deployed SHA', async () => {
    const { files, lines, result } = dryRun({ DEPLOYED: D }, [push(1, T, 'group', 0)]);
    await expect(result).resolves.toMatchObject({ deploy: true });
    expect(files['/out']).toBe(`deploy=true\ndeployed=${D}\n`);
    expect(lines[0]).toMatch(/^::notice title=Deploy catch-up::The deploy of main's tip a{40} was replaced in the deploy-prod group/);
  });

  it('an unreadable production SHA: deploy=false, deployed empty, a warning', async () => {
    const { files, lines, result } = dryRun({ DEPLOYED: '' }, []);
    await result;
    expect(files['/out']).toBe('deploy=false\ndeployed=\n');
    expect(lines[0]).toMatch(/^::warning title=Deploy catch-up::/);
  });

  it('throws on an API error and writes no output', async () => {
    const { files, lines, result } = dryRun({ DEPLOYED: D }, [], simple, { fail: () => true });
    await expect(result).rejects.toThrow('500');
    expect(files).toEqual({});
    expect(lines).toEqual([]);
  });

  it('throws when GITHUB_OUTPUT is not set', async () => {
    const { result } = dryRun({ DEPLOYED: T, GITHUB_OUTPUT: '' }, []);
    await expect(result).rejects.toThrow('GITHUB_OUTPUT is not set');
  });
});

describe('realGit against a real repository', () => {
  let dir: string;
  const shas: Record<string, string> = {};

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'catch-up-git-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd: dir,
        encoding: 'utf8',
      }).trim();
    const commit = (message: string) => {
      git('commit', '--quiet', '--allow-empty', '-m', message);
      return git('rev-parse', 'HEAD');
    };
    git('init', '--quiet', '--initial-branch=main');
    shas.d = commit('production');
    git('checkout', '--quiet', '-b', 'feature');
    shas.f = commit('feature work [skip ci]');
    git('checkout', '--quiet', 'main');
    git('merge', '--quiet', '--no-ff', '-m', 'Merge pull request #2', 'feature');
    shas.c = git('rev-parse', 'HEAD');
    shas.t = commit('Close 2.8 [skip ci]\n\nskip-checks: true');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('lists main\'s first-parent commits after D, newest first, with their messages', () => {
    const log = realGit(dir).firstParentLog(shas.d ?? '', shas.t ?? '');
    expect(log.map((c) => c.sha)).toEqual([shas.t, shas.c]);
    expect(log.map((c) => hasSkipToken(c.message))).toEqual([true, false]);
    expect(log[0]?.message).toContain('skip-checks: true');
  });

  it('answers commit and ancestry questions, and fails on an unknown commit', () => {
    const git = realGit(dir);
    expect(git.isCommit(shas.t ?? '')).toBe(true);
    expect(git.isCommit(sha('9'))).toBe(false);
    expect(git.isAncestor(shas.d ?? '', shas.t ?? '')).toBe(true);
    expect(git.isAncestor(shas.t ?? '', shas.d ?? '')).toBe(false);
    expect(() => git.firstParentLog(sha('9'), shas.t ?? '')).toThrow();
    expect(git.committerDate(shas.t ?? '')).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});

describe('the CLI, as ci.yml runs it', () => {
  let dir: string;
  let older: string;
  let tip: string;
  const script = fileURLToPath(new URL('./deploy-catch-up.mjs', import.meta.url));

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'catch-up-cli-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd: dir,
        encoding: 'utf8',
      }).trim();
    git('init', '--quiet', '--initial-branch=main');
    git('commit', '--quiet', '--allow-empty', '-m', 'production');
    older = git('rev-parse', 'HEAD');
    git('commit', '--quiet', '--allow-empty', '-m', 'Merge pull request #3');
    tip = git('rev-parse', 'HEAD');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function cli(deployed: string) {
    const output = join(dir, 'output');
    const summary = join(dir, 'summary');
    writeFileSync(output, '');
    writeFileSync(summary, '');
    const result = spawnSync(process.execPath, [script], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        GITHUB_SHA: tip,
        GITHUB_RUN_ID: '900',
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
        GITHUB_REPOSITORY: 'owner/repo',
        // Nothing listens here: any API read fails.
        GITHUB_API_URL: 'http://127.0.0.1:9',
        GH_TOKEN: 'not-a-token',
        DEPLOYED: deployed,
      },
    });
    return { status: result.status, stdout: result.stdout, output: readFileSync(output, 'utf8'), summary: readFileSync(summary, 'utf8') };
  }

  it('production on the tip: exit 0, deploy=false, the notice and the summary', () => {
    const r = cli(tip);
    expect(r.status).toBe(0);
    expect(r.output).toBe(`deploy=false\ndeployed=${tip}\n`);
    expect(r.stdout).toContain(`::notice title=Deploy catch-up::Production already runs main's tip ${tip}; nothing to deploy.`);
    expect(r.summary).toContain('### Deploy catch-up');
  });

  it('an API error: exit 1, an ::error line, and no output, so test and deploy are skipped', () => {
    const r = cli(older);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^::error title=Deploy catch-up::/m);
    expect(r.output).toBe('');
  });
});
