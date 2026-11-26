// Runs two shell steps of .github/workflows/ci.yml as written, with a fake `ssh`
// (the deploy job itself only runs on main): the deploy guard, unchanged for a push
// and, on schedule, skipping when production changed since `catch-up` read it; and
// `catch-up`'s read of the SHA production runs, which fails on an SSH failure; and
// `dispatch-off-main`'s refusal of a rollback started from another branch (#27).
// Also pins which jobs run in GitHub environment `production` and read the deploy
// secrets, and that none of them runs off main (S10, #64).
// Also pins the job and step names scripts/deploy-catch-up.mjs reads runs by.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPLOY_JOB, START_STEP, TEST_JOB } from './deploy-catch-up.mjs';

const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)), 'utf8');

/** The `run: |` script of the step named `name`, de-indented. */
function stepScript(name: string): string {
  const lines = workflow.split('\n');
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
  // A fake ssh: prints $FAKE_SSH_OUT and exits $FAKE_SSH_EXIT.
  writeFileSync(join(dir, 'ssh'), '#!/bin/sh\nprintf "%s" "$FAKE_SSH_OUT"\nexit "${FAKE_SSH_EXIT:-0}"\n');
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

const image = (sha: string) => `ghcr.io/abuabdillahi/bmad-todo-api:${sha}\n`;

describe('deploy guard step', () => {
  const guard = (event: string, live: string, checked = '') =>
    runStep('Skip if a newer SHA is already deployed', {
      GITHUB_EVENT_NAME: event,
      SHA: tip,
      CHECKED: checked,
      FAKE_SSH_OUT: live ? image(live) : '',
    });

  it('push: deploys over an older live SHA, though no catch-up check ran', () => {
    const r = guard('push', older);
    expect(r.status).toBe(0);
    expect(r.outputs).toBe('');
  });

  it('push: keeps a newer live SHA', () => {
    const r = guard('push', newer);
    expect(r.outputs).toBe('skip=true\n');
    expect(r.log).toContain(`is older than the deployed ${newer}`);
    expect(r.summary).toBe('');
  });

  it('push: an older live SHA that differs from an empty CHECKED is not a raced skip', () => {
    const r = guard('push', older, '');
    expect(r.outputs).toBe('');
    expect(r.summary).toBe('');
  });

  it('push: deploys when nothing runs', () => {
    expect(guard('push', '').outputs).toBe('');
  });

  it('schedule: deploys when production still runs what catch-up read', () => {
    const r = guard('schedule', older, older);
    expect(r.status).toBe(0);
    expect(r.outputs).toBe('');
  });

  it('schedule: skips when production changed since catch-up read it (raced), and says so in the step summary', () => {
    const r = guard('schedule', older, 'f'.repeat(40));
    expect(r.status).toBe(0);
    expect(r.outputs).toBe('skip=true\n');
    const reason = `Skipped: production changed from ${'f'.repeat(40)} to ${older} since the catch-up check; the next scheduled check decides again.`;
    expect(r.log).toContain(`::notice::${reason}`);
    expect(r.summary).toBe(`### Deploy catch-up\n\n${reason}\n`);
  });

  it('schedule: skips when nothing runs any more', () => {
    expect(guard('schedule', '', older).outputs).toBe('skip=true\n');
  });

  it('schedule: keeps a newer live SHA, and says so in the step summary', () => {
    const r = guard('schedule', newer, older);
    expect(r.outputs).toBe('skip=true\n');
    expect(r.log).toContain(`is older than the deployed ${newer}`);
    expect(r.summary).toBe(`### Deploy catch-up\n\nSkipped: ${tip} is older than the deployed ${newer}, which stays live.\n`);
  });

  it('push: keeps a newer live SHA and writes no step summary, as before', () => {
    expect(guard('push', newer).summary).toBe('');
  });
});

describe("catch-up's read of the SHA production runs", () => {
  const read = (out: string, exit = '0') =>
    runStep('Read the SHA production runs', { FAKE_SSH_OUT: out, FAKE_SSH_EXIT: exit });

  it('writes the running image tag', () => {
    const r = read(image(older));
    expect(r.status).toBe(0);
    expect(r.outputs).toBe(`deployed=${older}\n`);
  });

  it('takes the first line when docker ps prints several', () => {
    const r = read(image(older) + image(newer));
    expect(r.status).toBe(0);
    expect(r.outputs).toBe(`deployed=${older}\n`);
  });

  it('writes an empty SHA when no container runs', () => {
    const r = read('');
    expect(r.status).toBe(0);
    expect(r.outputs).toBe('deployed=\n');
  });

  it('fails the step when ssh fails', () => {
    const r = read('', '255');
    expect(r.status).not.toBe(0);
    expect(r.outputs).toBe('');
  });
});

/** The lines of job `id` under `jobs:`, up to the next job. */
function jobBlock(id: string): string[] {
  const lines = workflow.split('\n');
  const jobsAt = lines.indexOf('jobs:');
  const start = lines.findIndex((line, i) => i > jobsAt && line === `  ${id}:`);
  if (jobsAt < 0 || start < 0) throw new Error(`No job ${id}`);
  const end = lines.findIndex((line, i) => i > start && /^ {0,2}\S/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

describe('the names scripts/deploy-catch-up.mjs reads runs by', () => {
  it.each([TEST_JOB, DEPLOY_JOB])('job %s exists with no name: override, so the API names it by its id', (id) => {
    const block = jobBlock(id);
    expect(block.length).toBeGreaterThan(0);
    expect(block.filter((line) => /^ {4}name:/.test(line))).toEqual([]);
  });

  it(`the deploy job has a step named exactly ${START_STEP}`, () => {
    expect(jobBlock(DEPLOY_JOB).filter((line) => line.trim() === `- name: ${START_STEP}`)).toHaveLength(1);
  });
});

describe("catch-up's outputs reach test and the guard", () => {
  const catchUp = () => jobBlock('catch-up').map((line) => line.trim());

  it('the job outputs read the decide step, which writes deploy= and deployed= (main() tests)', () => {
    const block = catchUp();
    expect(block).toContain('deploy: ${{ steps.decide.outputs.deploy }}');
    expect(block).toContain('deployed: ${{ steps.decide.outputs.deployed }}');
    expect(block).toContain('id: decide');
    expect(block).toContain('run: node scripts/deploy-catch-up.mjs');
  });

  it("the decide step reads the read step's deployed= output", () => {
    const block = catchUp();
    expect(block).toContain('id: live');
    expect(block).toContain('DEPLOYED: ${{ steps.live.outputs.deployed }}');
  });

  it('test and the guard read those job outputs', () => {
    expect(jobBlock(TEST_JOB).join('\n')).toContain("needs.catch-up.outputs.deploy == 'true'");
    expect(jobBlock(DEPLOY_JOB).map((l) => l.trim())).toContain('CHECKED: ${{ needs.catch-up.outputs.deployed }}');
  });
});

/** A job's or a step's `if:` (folded `>-` or plain), from `lines` at `indent`. */
function ifAt(lines: string[], indent: number): string | null {
  const at = lines.findIndex((line) => line.startsWith(`${' '.repeat(indent)}if: `));
  if (at < 0) return null;
  const value = lines[at].slice(indent + 4).trim();
  if (value !== '>-' && value !== '>') return value;
  const parts: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && line.search(/\S/) <= indent) break;
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

/** The lines of step `name` in job `id`, and the step's indent. */
function stepLines(id: string, name: string): { lines: string[]; indent: number } {
  const block = jobBlock(id);
  const start = block.findIndex((l) => l.trim() === `- name: ${name}`);
  if (start < 0) throw new Error(`No step ${name} in ${id}`);
  const indent = block[start].indexOf('-');
  const end = block.findIndex((l, i) => i > start && l.trim() && l.search(/\S/) <= indent);
  return { lines: block.slice(start, end < 0 ? undefined : end), indent };
}

type Ctx = { github: { event_name: string; ref: string }; needs: Record<string, { result: string; outputs: Record<string, string> }>; steps?: Record<string, { outputs: Record<string, string> }> };

/**
 * Evaluates a GitHub Actions `if:` over the few operators ci.yml uses, with
 * GitHub's rule that an expression with no status function gets an implicit
 * `success()` (every needed job succeeded).
 */
function evaluate(expression: string | null, ctx: Ctx, needed: string[]): boolean {
  const success = needed.every((n) => ctx.needs[n]?.result === 'success');
  if (expression === null) return success;
  const js = expression.replace(/needs\.([\w-]+)\./g, (_m, id: string) => `needs[${JSON.stringify(id)}].`);
  const fn = new Function('github', 'needs', 'steps', 'success', 'cancelled', 'always', 'failure', `return (${js});`);
  const value = Boolean(fn(ctx.github, ctx.needs, ctx.steps ?? {}, () => success, () => false, () => true, () => false));
  return /\b(success|failure|cancelled|always)\(\)/.test(expression) ? value : success && value;
}

type Scenario = {
  event: string;
  ref?: string;
  /** catch-up's result when it runs, and its decision. */
  catchUp?: { result: string; deploy?: string; deployed?: string };
  test?: string;
  gate?: { result: string; clear?: string };
};

const OFF_MAIN_JOB = 'dispatch-off-main';

/** Which jobs run, in dependency order, for one event. */
function jobsThatRun(s: Scenario) {
  const ctx: Ctx = { github: { event_name: s.event, ref: s.ref ?? 'refs/heads/main' }, needs: {} };
  const ran: Record<string, boolean> = {};
  const plan: Record<string, { result: string; outputs: Record<string, string> }> = {
    'dispatch-off-main': { result: 'failure', outputs: {} },
    'catch-up': { result: s.catchUp?.result ?? 'success', outputs: { deploy: s.catchUp?.deploy ?? '', deployed: s.catchUp?.deployed ?? '' } },
    test: { result: s.test ?? 'success', outputs: {} },
    'catch-up-gate': { result: s.gate?.result ?? 'success', outputs: { clear: s.gate?.clear ?? '' } },
    deploy: { result: 'success', outputs: {} },
  };
  for (const id of [OFF_MAIN_JOB, 'catch-up', TEST_JOB, 'catch-up-gate', DEPLOY_JOB]) {
    const needed = needsOf(id);
    ran[id] = evaluate(ifAt(jobBlock(id), 4), { ...ctx, needs: Object.fromEntries(needed.map((n) => [n, ctx.needs[n]])) }, needed);
    ctx.needs[id] = ran[id] ? plan[id] : { result: 'skipped', outputs: {} };
  }
  return ran;
}

describe('the job graph, evaluated from ci.yml', () => {
  it('needs: catch-up before test; catch-up and test before the gate; all three before deploy', () => {
    expect(needsOf(OFF_MAIN_JOB)).toEqual([]);
    expect(needsOf(TEST_JOB)).toEqual(['catch-up']);
    expect(needsOf('catch-up-gate')).toEqual(['catch-up', TEST_JOB]);
    expect(needsOf(DEPLOY_JOB)).toEqual(['catch-up', TEST_JOB, 'catch-up-gate']);
  });

  it.each<[string, Scenario, Record<string, boolean>]>([
    ['push to main: test and deploy, as before', { event: 'push' }, { [OFF_MAIN_JOB]: false, 'catch-up': false, test: true, 'catch-up-gate': false, deploy: true }],
    ['push to main, red test: no deploy', { event: 'push', test: 'failure' }, { [OFF_MAIN_JOB]: false, 'catch-up': false, test: true, 'catch-up-gate': false, deploy: false }],
    ['push to a branch: test only', { event: 'push', ref: 'refs/heads/story-x' }, { [OFF_MAIN_JOB]: false, 'catch-up': false, test: true, 'catch-up-gate': false, deploy: false }],
    ['rollback by hand on main: deploy only', { event: 'workflow_dispatch' }, { [OFF_MAIN_JOB]: false, 'catch-up': false, test: false, 'catch-up-gate': false, deploy: true }],
    ['dispatch on a branch: the run fails in dispatch-off-main, nothing else runs', { event: 'workflow_dispatch', ref: 'refs/heads/x' }, { [OFF_MAIN_JOB]: true, 'catch-up': false, test: false, 'catch-up-gate': false, deploy: false }],
    ['dispatch on a branch named like main: the same', { event: 'workflow_dispatch', ref: 'refs/heads/main-old' }, { [OFF_MAIN_JOB]: true, 'catch-up': false, test: false, 'catch-up-gate': false, deploy: false }],
    ['dispatch on a tag: the same', { event: 'workflow_dispatch', ref: 'refs/tags/main' }, { [OFF_MAIN_JOB]: true, 'catch-up': false, test: false, 'catch-up-gate': false, deploy: false }],
    ['schedule, nothing to deploy', { event: 'schedule', catchUp: { result: 'success', deploy: 'false' } }, { [OFF_MAIN_JOB]: false, 'catch-up': true, test: false, 'catch-up-gate': false, deploy: false }],
    ['schedule, catch-up failed after writing deploy=true', { event: 'schedule', catchUp: { result: 'failure', deploy: 'true' } }, { [OFF_MAIN_JOB]: false, 'catch-up': true, test: false, 'catch-up-gate': false, deploy: false }],
    ['schedule, deploy, red test', { event: 'schedule', catchUp: { result: 'success', deploy: 'true' }, test: 'failure' }, { [OFF_MAIN_JOB]: false, 'catch-up': true, test: true, 'catch-up-gate': false, deploy: false }],
    ['schedule, deploy, gate clear', { event: 'schedule', catchUp: { result: 'success', deploy: 'true' }, gate: { result: 'success', clear: 'true' } }, { [OFF_MAIN_JOB]: false, 'catch-up': true, test: true, 'catch-up-gate': true, deploy: true }],
    ['schedule, deploy, a rollback pending or ran meanwhile', { event: 'schedule', catchUp: { result: 'success', deploy: 'true' }, gate: { result: 'success', clear: 'false' } }, { [OFF_MAIN_JOB]: false, 'catch-up': true, test: true, 'catch-up-gate': true, deploy: false }],
    ['schedule, deploy, gate failed', { event: 'schedule', catchUp: { result: 'success', deploy: 'true' }, gate: { result: 'failure' } }, { [OFF_MAIN_JOB]: false, 'catch-up': true, test: true, 'catch-up-gate': true, deploy: false }],
  ])('%s', (_title, scenario, expected) => {
    expect(jobsThatRun(scenario)).toEqual(expected);
  });

  it.each([
    ['Skip if a newer SHA is already deployed', { push: true, schedule: true, workflow_dispatch: false }],
    ['Download the tested images', { push: true, schedule: true, workflow_dispatch: false }],
    ['Push the tested images to GHCR', { push: true, schedule: true, workflow_dispatch: false }],
    ['Start production', { push: true, schedule: true, workflow_dispatch: true }],
  ])('deploy step %s runs for %j (guard not skipping)', (name, expected) => {
    const { lines, indent } = stepLines(DEPLOY_JOB, name);
    for (const [event, runs] of Object.entries(expected)) {
      const ctx: Ctx = { github: { event_name: event, ref: 'refs/heads/main' }, needs: {}, steps: { guard: { outputs: { skip: '' } } } };
      expect(evaluate(ifAt(lines, indent + 2), ctx, []), `${name} on ${event}`).toBe(runs);
    }
  });

  it('the steps after the guard are skipped when it skips', () => {
    for (const name of ['Download the tested images', 'Push the tested images to GHCR', 'Start production']) {
      const { lines, indent } = stepLines(DEPLOY_JOB, name);
      const ctx: Ctx = { github: { event_name: 'schedule', ref: 'refs/heads/main' }, needs: {}, steps: { guard: { outputs: { skip: 'true' } } } };
      expect(evaluate(ifAt(lines, indent + 2), ctx, [])).toBe(false);
    }
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

  it('needs no job, no job needs it, and it reads no secret or variable and reaches no host', () => {
    const block = jobBlock(OFF_MAIN_JOB).join('\n');
    expect(block).not.toMatch(/secrets\.|vars\.|ssh|scp|docker|concurrency|needs:|environment:/);
    expect(block).toContain('permissions: {}');
    for (const id of ['catch-up', TEST_JOB, 'catch-up-gate', DEPLOY_JOB]) expect(needsOf(id)).not.toContain(OFF_MAIN_JOB);
  });
});

describe('the production environment holds the deploy secrets, and only main reaches it (S10, #64)', () => {
  const DEPLOY_SECRETS = ['DEPLOY_SSH_KEY', 'DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_KNOWN_HOSTS', 'TUNNEL_TOKEN'];
  const IN_PRODUCTION = ['catch-up', DEPLOY_JOB];

  /** Every job id under `jobs:`, so a job added later is checked too. */
  const jobIds = () => {
    const lines = workflow.split('\n');
    const jobsAt = lines.indexOf('jobs:');
    const end = lines.findIndex((line, i) => i > jobsAt && /^\S/.test(line));
    return lines
      .slice(jobsAt + 1, end < 0 ? undefined : end)
      .map((line) => /^ {2}([\w-]+):\s*$/.exec(line)?.[1])
      .filter((id): id is string => Boolean(id));
  };
  const namesProduction = (id: string) => jobBlock(id).includes('    environment: production');

  it('the workflow has the five jobs the job graph evaluates', () => {
    expect(jobIds().sort()).toEqual([OFF_MAIN_JOB, 'catch-up', TEST_JOB, 'catch-up-gate', DEPLOY_JOB].sort());
  });

  it('only catch-up and deploy name environment production, as a job key, and nothing else names an environment', () => {
    expect(jobIds().filter(namesProduction)).toEqual(IN_PRODUCTION);
    expect(workflow.match(/^\s*environment:.*$/gm)?.map((l) => l.trim())).toEqual(IN_PRODUCTION.map(() => 'environment: production'));
  });

  it('no other job reads any of the five deploy secrets', () => {
    for (const id of jobIds()) {
      const block = jobBlock(id).join('\n');
      // GitHub matches context property names in any case.
      const read = DEPLOY_SECRETS.filter((name) => new RegExp(`secrets\\.${name}\\b`, 'i').test(block));
      if (namesProduction(id)) expect(read.length, id).toBeGreaterThan(0);
      else expect(read, id).toEqual([]);
    }
  });

  it('deploy reads all five, and catch-up the four it needs to reach the host', () => {
    const reads = (id: string) => DEPLOY_SECRETS.filter((name) => jobBlock(id).join('\n').includes(`\${{ secrets.${name} }}`));
    expect(reads(DEPLOY_JOB)).toEqual(DEPLOY_SECRETS);
    expect(reads('catch-up')).toEqual(['DEPLOY_SSH_KEY', 'DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_KNOWN_HOSTS']);
  });

  it('no job reads secrets by a computed name or as a whole, and none passes them on', () => {
    // Function and context names are case-insensitive in GitHub expressions.
    expect(workflow).not.toMatch(/secrets\s*\[|tojson\(\s*secrets|secrets:\s*inherit/i);
  });

  it('nothing outside those two jobs, such as the workflow-level env:, names a deploy secret', () => {
    const count = (text: string) => DEPLOY_SECRETS.reduce((n, name) => n + (text.match(new RegExp(`secrets\\.${name}\\b`, 'gi'))?.length ?? 0), 0);
    expect(count(workflow)).toBe(IN_PRODUCTION.reduce((n, id) => n + count(jobBlock(id).join('\n')), 0));
  });

  // Once entry 18 limits production's deployment branches to main, GitHub refuses a job
  // that names it on any other ref. Schedules run on the default branch, main, only.
  const refs = ['refs/heads/main', 'refs/heads/story-x', 'refs/heads/main-old', 'refs/tags/main'];
  const scenarios: Scenario[] = [];
  for (const test of ['success', 'failure']) {
    for (const ref of refs) {
      scenarios.push({ event: 'push', ref, test }, { event: 'workflow_dispatch', ref, test });
    }
    for (const catchUp of ['success', 'failure']) {
      for (const deploy of ['true', 'false']) {
        for (const gate of [{ result: 'success', clear: 'true' }, { result: 'success', clear: 'false' }, { result: 'failure' }]) {
          scenarios.push({ event: 'schedule', ref: 'refs/heads/main', catchUp: { result: catchUp, deploy }, test, gate });
        }
      }
    }
  }

  it.each(scenarios)('no job naming production runs off main: %j', (scenario) => {
    const ran = jobsThatRun(scenario);
    for (const id of IN_PRODUCTION) {
      if (ran[id]) expect(scenario.ref, id).toBe('refs/heads/main');
    }
  });

  it('a branch push and a dispatch off main run no job that names production', () => {
    expect(IN_PRODUCTION.filter((id) => jobsThatRun({ event: 'push', ref: 'refs/heads/story-x' })[id])).toEqual([]);
    for (const ref of ['refs/heads/x', 'refs/tags/main']) {
      expect(IN_PRODUCTION.filter((id) => jobsThatRun({ event: 'workflow_dispatch', ref })[id])).toEqual([]);
    }
  });
});
