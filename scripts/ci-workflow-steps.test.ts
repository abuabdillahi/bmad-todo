// Runs two shell steps of .github/workflows/ci.yml as written, with a fake `ssh`
// (the deploy job itself only runs on main): the deploy guard, unchanged for a push
// and, on schedule, skipping when production changed since `catch-up` read it; and
// `catch-up`'s read of the SHA production runs, which fails on an SSH failure.
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
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
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
