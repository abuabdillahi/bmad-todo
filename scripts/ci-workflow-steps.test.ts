// Runs two shell steps of .github/workflows/ci.yml as written, with a fake `ssh`
// (the deploy job itself only runs on main): the deploy guard, which keeps a newer
// live SHA, and `dispatch-off-main`'s refusal of a rollback started from another
// branch (#27). Also pins that only `deploy` runs in GitHub environment `production`
// and reads the deploy secrets, and that it never runs off main (S10, #64).
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)), 'utf8');
const lines = workflow.split('\n');

const OFF_MAIN_JOB = 'dispatch-off-main';
const TEST_JOB = 'test';
const DEPLOY_JOB = 'deploy';
const JOBS = [OFF_MAIN_JOB, TEST_JOB, DEPLOY_JOB];

/** The `run: |` script of the step named `name`, de-indented. */
function stepScript(name: string): string {
  const start = lines.findIndex((line) => line.trim() === `- name: ${name}`);
  if (start < 0) throw new Error(`No step named ${name}`);
  const stepIndent = lines[start].indexOf('-');
  let i = start + 1;
  while (i < lines.length && !/^\s*run: \|\s*$/.test(lines[i])) {
    if (lines[i].trim() && lines[i].search(/\S/) <= stepIndent) throw new Error(`Step ${name} has no run block`);
    i += 1;
  }
  const runIndent = lines[i].search(/\S/);
  const body: string[] = [];
  for (i += 1; i < lines.length; i += 1) {
    if (lines[i].trim() && lines[i].search(/\S/) <= runIndent) break;
    body.push(lines[i]);
  }
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(indent)).join('\n');
}

let dir: string;
let older: string; // what production runs before the tip
let tip: string;
let newer: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ci-steps-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
  git('init', '--quiet');
  const commit = (message: string) => {
    git('commit', '--quiet', '--allow-empty', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  older = commit('older');
  tip = commit('tip');
  newer = commit('newer');
  // A fake ssh: prints $FAKE_SSH_OUT.
  writeFileSync(join(dir, 'ssh'), '#!/bin/sh\nprintf "%s" "$FAKE_SSH_OUT"\n');
  chmodSync(join(dir, 'ssh'), 0o755);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Runs a step the way the runner does (`bash -e`), returning its exit code, log, outputs and step summary. */
function runStep(name: string, env: Record<string, string>) {
  const output = join(dir, 'output');
  const summary = join(dir, 'summary');
  writeFileSync(output, '');
  writeFileSync(summary, '');
  const result = spawnSync('bash', ['-e', '-c', stepScript(name)], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...env },
  });
  return {
    status: result.status,
    log: result.stdout,
    outputs: readFileSync(output, 'utf8'),
    summary: readFileSync(summary, 'utf8'),
  };
}

describe('deploy guard step', () => {
  const guard = (live: string) =>
    runStep('Skip if a newer SHA is already deployed', {
      GITHUB_EVENT_NAME: 'push',
      SHA: tip,
      FAKE_SSH_OUT: live ? `ghcr.io/abuabdillahi/bmad-todo-api:${live}\n` : '',
    });

  it('deploys over an older live SHA', () => {
    const r = guard(older);
    expect(r.status).toBe(0);
    expect(r.outputs).toBe('');
  });

  it('redeploys the SHA that is already live', () => {
    expect(guard(tip).outputs).toBe('');
  });

  it('keeps a newer live SHA', () => {
    const r = guard(newer);
    expect(r.outputs).toBe('skip=true\n');
    expect(r.log).toContain(`is older than the deployed ${newer}`);
  });

  it('deploys when nothing runs', () => {
    expect(guard('').outputs).toBe('');
  });
});

/** The lines of job `id` under `jobs:`, up to the next job. */
function jobBlock(id: string): string[] {
  const jobsAt = lines.indexOf('jobs:');
  const start = lines.findIndex((line, i) => i > jobsAt && line === `  ${id}:`);
  if (jobsAt < 0 || start < 0) throw new Error(`No job ${id}`);
  const end = lines.findIndex((line, i) => i > start && /^ {0,2}\S/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** Every job id under `jobs:`, so a job added later is checked too. */
function jobIds(): string[] {
  const jobsAt = lines.indexOf('jobs:');
  const end = lines.findIndex((line, i) => i > jobsAt && /^\S/.test(line));
  return lines
    .slice(jobsAt + 1, end < 0 ? undefined : end)
    .map((line) => /^ {2}([\w-]+):\s*$/.exec(line)?.[1])
    .filter((id): id is string => Boolean(id));
}

/** A job's `if:` (folded `>-` or plain). */
function jobIf(id: string): string | null {
  const block = jobBlock(id);
  const at = block.findIndex((line) => line.startsWith('    if: '));
  if (at < 0) return null;
  const value = block[at].slice('    if: '.length).trim();
  if (value !== '>-' && value !== '>') return value;
  const parts: string[] = [];
  for (const line of block.slice(at + 1)) {
    if (line.trim() && line.search(/\S/) <= 4) break;
    parts.push(line.trim());
  }
  return parts.join(' ').trim();
}

/** The `needs:` of job `id`. */
function needsOf(id: string): string[] {
  const line = jobBlock(id).find((l) => l.startsWith('    needs: '));
  if (!line) return [];
  return line.slice('    needs: '.length).replace(/[[\]]/g, '').split(',').map((n) => n.trim()).filter(Boolean);
}

type Needs = Record<string, { result: string }>;

/**
 * Evaluates a job's `if:` over the few operators ci.yml uses, with GitHub's rule
 * that an expression with no status function gets an implicit `success()`.
 */
function evaluate(expression: string | null, github: { event_name: string; ref: string }, needs: Needs): boolean {
  const success = Object.values(needs).every((n) => n.result === 'success');
  if (expression === null) return success;
  const js = expression.replace(/needs\.([\w-]+)\./g, (_m, id: string) => `needs[${JSON.stringify(id)}].`);
  const fn = new Function('github', 'needs', 'success', 'cancelled', 'always', 'failure', `return (${js});`);
  const value = Boolean(fn(github, needs, () => success, () => false, () => true, () => false));
  return /\b(success|failure|cancelled|always)\(\)/.test(expression) ? value : success && value;
}

/** Which jobs run, in dependency order, for one event, ref and test result. */
function jobsThatRun(event: string, ref = 'refs/heads/main', test = 'success') {
  const results: Record<string, string> = { [OFF_MAIN_JOB]: 'failure', [TEST_JOB]: test, [DEPLOY_JOB]: 'success' };
  const done: Needs = {};
  const ran: Record<string, boolean> = {};
  for (const id of JOBS) {
    const needs = Object.fromEntries(needsOf(id).map((n) => [n, done[n]]));
    ran[id] = evaluate(jobIf(id), { event_name: event, ref }, needs);
    done[id] = { result: ran[id] ? results[id] : 'skipped' };
  }
  return ran;
}

describe('the job graph, evaluated from ci.yml', () => {
  it('has the three jobs; deploy needs test; nothing needs dispatch-off-main', () => {
    expect(jobIds().sort()).toEqual([...JOBS].sort());
    expect(needsOf(OFF_MAIN_JOB)).toEqual([]);
    expect(needsOf(TEST_JOB)).toEqual([]);
    expect(needsOf(DEPLOY_JOB)).toEqual([TEST_JOB]);
  });

  it.each<[string, [string, string?, string?], Record<string, boolean>]>([
    ['push to main: test and deploy', ['push'], { [OFF_MAIN_JOB]: false, test: true, deploy: true }],
    ['push to main, red test: no deploy', ['push', 'refs/heads/main', 'failure'], { [OFF_MAIN_JOB]: false, test: true, deploy: false }],
    ['push to a branch: test only', ['push', 'refs/heads/story-x'], { [OFF_MAIN_JOB]: false, test: true, deploy: false }],
    ['rollback by hand on main: deploy only', ['workflow_dispatch'], { [OFF_MAIN_JOB]: false, test: false, deploy: true }],
    ['dispatch on a branch: the run fails in dispatch-off-main, nothing else runs', ['workflow_dispatch', 'refs/heads/x'], { [OFF_MAIN_JOB]: true, test: false, deploy: false }],
    ['dispatch on a branch named like main: the same', ['workflow_dispatch', 'refs/heads/main-old'], { [OFF_MAIN_JOB]: true, test: false, deploy: false }],
    ['dispatch on a tag: the same', ['workflow_dispatch', 'refs/tags/main'], { [OFF_MAIN_JOB]: true, test: false, deploy: false }],
  ])('%s', (_title, args, expected) => {
    expect(jobsThatRun(...args)).toEqual(expected);
  });
});

describe('dispatch-off-main: a rollback started off main fails with the reason (#27)', () => {
  const refuse = (refName: string) =>
    runStep('Refuse a rollback started off main', { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF_NAME: refName });

  it('fails the run with an ::error:: telling the person to choose main under "Use workflow from", and says so in the step summary', () => {
    const r = refuse('story-x');
    expect(r.status).toBe(1);
    const reason =
      'Rollback runs only from main, and this run was started from story-x, so nothing was deployed. Run the workflow again and choose main under "Use workflow from".';
    expect(r.log).toBe(`::error title=Rollback not run::${reason}\n`);
    expect(r.summary).toBe(`### Rollback not run\n\n${reason}\n`);
    expect(r.outputs).toBe('');
  });

  it("escapes % in the branch name in the ::error:: only, so it cannot forge the command's encoding; the summary shows it as is", () => {
    const r = refuse('a%0Ab');
    expect(r.log).toContain('started from a%250Ab, so');
    expect(r.summary).toContain('started from a%0Ab, so');
  });

  it('needs no job, and it reads no secret or variable and reaches no host', () => {
    const block = jobBlock(OFF_MAIN_JOB).join('\n');
    expect(block).not.toMatch(/secrets\.|vars\.|ssh|scp|docker|concurrency|needs:|environment:/);
    expect(block).toContain('permissions: {}');
  });
});

describe('the production environment holds the deploy secrets, and only main reaches it (S10, #64)', () => {
  const DEPLOY_SECRETS = ['DEPLOY_SSH_KEY', 'DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_KNOWN_HOSTS', 'TUNNEL_TOKEN'];
  // GitHub matches context property names in any case.
  const count = (text: string) =>
    DEPLOY_SECRETS.reduce((n, name) => n + (text.match(new RegExp(`secrets\\.${name}\\b`, 'gi'))?.length ?? 0), 0);

  it('only deploy names an environment, production, as a job key', () => {
    expect(jobIds().filter((id) => jobBlock(id).includes('    environment: production'))).toEqual([DEPLOY_JOB]);
    expect(workflow.match(/^\s*environment:.*$/gm)?.map((l) => l.trim())).toEqual(['environment: production']);
  });

  it('deploy reads all five, and nothing outside it, such as the workflow-level env:, names one', () => {
    const block = jobBlock(DEPLOY_JOB).join('\n');
    expect(DEPLOY_SECRETS.filter((name) => block.includes(`\${{ secrets.${name} }}`))).toEqual(DEPLOY_SECRETS);
    expect(count(workflow)).toBe(count(block));
  });

  it('no job reads secrets by a computed name or as a whole, and none passes them on', () => {
    // Function and context names are case-insensitive in GitHub expressions.
    expect(workflow).not.toMatch(/secrets\s*\[|tojson\(\s*secrets|secrets:\s*inherit/i);
  });

  // With production's deployment branches limited to main, GitHub refuses a job that
  // names it on any other ref.
  it.each(
    ['push', 'workflow_dispatch'].flatMap((event) =>
      ['refs/heads/story-x', 'refs/heads/main-old', 'refs/tags/main'].flatMap((ref) =>
        ['success', 'failure'].map((test) => [event, ref, test] as const),
      ),
    ),
  )('deploy does not run for %s on %s (test %s)', (event, ref, test) => {
    expect(jobsThatRun(event, ref, test)[DEPLOY_JOB]).toBe(false);
  });
});
