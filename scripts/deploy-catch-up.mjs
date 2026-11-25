#!/usr/bin/env node
// Deploy catch-up (R22, AD-18): the scheduled `catch-up` job of ci.yml runs
// this to decide whether main's tip needs testing and deploying. It compares
// the tip T (GITHUB_SHA) with the SHA D production runs (DEPLOYED, read over
// SSH the way the deploy guard does). When T is newer, it walks main's
// first-parent history D..T: skip-token commits (`[skip ci]` and the like)
// need no deploy, so it judges C, the newest commit without one, from C's
// `main` push runs and the scheduled runs of T down to C. It deploys T only
// when the newest attempted run's deploy was cancelled by the `deploy-prod`
// concurrency group, or when C has no push run on main. It writes
// `deploy=true|false` and `deployed=<validated SHA or empty>` to
// $GITHUB_OUTPUT, says why in a ::notice:: or ::warning:: and in the step
// summary, and fails (exit 1) on any git or API error, so nothing is tested or
// deployed.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The names in ci.yml this script reads runs by; scripts/ci-workflow-steps.test.ts pins them. */
export const TEST_JOB = 'test';
export const DEPLOY_JOB = 'deploy';
export const START_STEP = 'Start production';

/** Pages of 100 read from one list before giving up (fail closed). */
export const MAX_PAGES = 10;
/** Scheduled runs per commit read to find one still in progress, newest first. */
export const RECENT_SCHEDULED = 20;

/** Conclusions of a scheduled run that tested or deployed and did not succeed. */
export const ENDED_STATUSES = ['failure', 'timed_out', 'cancelled'];

const SHA = /^[0-9a-f]{40}$/;
const SKIP_TOKENS = ['[skip ci]', '[ci skip]', '[no ci]', '[skip actions]', '[actions skip]'];
// GitHub reads `skip-checks: true` only as a trailer: the message's last line, after a blank line.
const SKIP_CHECKS_TRAILER = /\n[ \t]*\r?\nskip-checks: ?true$/;
// GitHub's message when a newer pending job in the group replaces this one.
// A secret's value in the text is masked as ***.
const GROUP_CANCELLATION = /higher priority waiting request for '(deploy|\*\*\*)-prod'/;

/**
 * @typedef {{ name: string, status: string, conclusion: string | null }} Step
 * @typedef {{ id?: number, name: string, status: string, conclusion: string | null, steps?: Step[] }} Job
 * @typedef {{ message?: string | null, title?: string | null }} Annotation
 * @typedef {{ id: number, event: string, status: string, conclusion: string | null, created_at: string, run_started_at?: string, html_url: string, head_sha?: string, head_branch?: string | null }} Run
 * @typedef {'in-progress' | 'red' | 'deployed' | 'deploy-failed' | 'cancelled-by-group' | 'cancelled' | 'not-attempted'} Outcome
 * @typedef {{ id: number, url: string, outcome: Outcome, note?: string }} RunOutcome
 * @typedef {'equal' | 'tip-older' | 'tip-newer' | 'unrelated' | 'unknown'} Relation
 * @typedef {{ sha: string, message: string }} Commit
 * @typedef {{
 *   tip: string, deployed: string, rawDeployed: string, relation: Relation,
 *   candidate: string | null,
 *   pushRunsOfCandidate: number,
 *   running: { id: number, url: string, byHand: boolean } | null,
 *   rollback: { id: number, url: string, createdAt: string } | null,
 *   newest: RunOutcome | null,
 * }} Facts
 * @typedef {{ deploy: boolean, level: 'notice' | 'warning', reason: string }} Decision
 * @typedef {{
 *   isCommit(sha: string): boolean,
 *   isAncestor(ancestor: string, descendant: string): boolean,
 *   firstParentLog(from: string, to: string): Commit[],
 *   committerDate(sha: string): string,
 * }} Git
 * @typedef {(path: string) => Promise<any>} Api
 */

/**
 * Whether GitHub runs no workflow for a push whose head commit has this message.
 * @param {string} message
 */
export function hasSkipToken(message) {
  return SKIP_TOKENS.some((token) => message.includes(token)) || SKIP_CHECKS_TRAILER.test(message.replace(/\s+$/, ''));
}

/**
 * Whether the deploy job's annotations say the `deploy-prod` group cancelled it.
 * @param {Annotation[]} annotations
 */
export function cancelledByGroup(annotations) {
  return annotations.some((a) => GROUP_CANCELLATION.test(a.message ?? '') || GROUP_CANCELLATION.test(a.title ?? ''));
}

/**
 * What one run of ci.yml did for its commit, from its latest attempt's jobs.
 * A cancelled test, or a cancelled deploy its annotations do not attribute to
 * the `deploy-prod` group, is `cancelled` (deliberate).
 * @param {Run} run
 * @param {Job[]} jobs
 * @param {Annotation[]} [deployAnnotations] the deploy job's, when it was cancelled
 * @returns {Outcome}
 */
export function summariseRun(run, jobs, deployAnnotations = []) {
  if (run.status !== 'completed') return 'in-progress';
  const test = jobs.find((job) => job.name === TEST_JOB);
  switch (test?.conclusion) {
    case 'success':
      break;
    case 'failure':
    case 'timed_out':
      return 'red';
    case 'cancelled':
      return 'cancelled';
    default:
      // Skipped (a no-op scheduled run), absent, or never started.
      return 'not-attempted';
  }
  const deploy = jobs.find((job) => job.name === DEPLOY_JOB);
  switch (deploy?.conclusion) {
    case 'success': {
      // The guard skips "Start production" when a newer SHA was already live,
      // or, on schedule, when production changed since the check.
      const start = deploy.steps?.find((step) => step.name === START_STEP);
      return start?.conclusion === 'success' ? 'deployed' : 'not-attempted';
    }
    case 'failure':
    case 'timed_out':
      return 'deploy-failed';
    case 'cancelled':
      return cancelledByGroup(deployAnnotations) ? 'cancelled-by-group' : 'cancelled';
    default:
      // Skipped (a branch push) or absent.
      return 'not-attempted';
  }
}

/** The raw tag, safe to print in a workflow command. */
function printable(raw) {
  return `"${raw.replace(/[^\w.-]/g, '?').slice(0, 80)}"`;
}

/**
 * Whether to test and deploy main's tip: the plan's effective matrix, first matching row.
 * @param {Facts} facts
 * @returns {Decision}
 */
export function decide(facts) {
  const { tip, deployed, candidate } = facts;
  const notice = (reason, deploy = false) => ({ deploy, level: /** @type {const} */ ('notice'), reason });
  const warning = (reason) => ({ deploy: false, level: /** @type {const} */ ('warning'), reason });

  // Rows 1-3.
  switch (facts.relation) {
    case 'equal':
      return notice(`Production already runs main's tip ${tip}; nothing to deploy.`);
    case 'tip-older':
      return notice(`Production runs ${deployed}, which is newer than main's tip ${tip}; nothing to deploy.`);
    case 'unrelated':
      return warning(
        `Production runs ${deployed}, which is neither older nor newer than main's tip ${tip}; not deploying. A person should check production.`,
      );
    case 'unknown':
      return warning(
        facts.rawDeployed
          ? `Production's api image tag ${printable(facts.rawDeployed)} is not a commit of this repository; not deploying main's tip ${tip}. A person should check production.`
          : `Production runs no api container of project todo; not deploying main's tip ${tip}. A person should check production.`,
      );
    case 'tip-newer':
      break;
    default:
      throw new Error(`Unknown relation: ${facts.relation}`);
  }

  // Row 4.
  if (!candidate) {
    return notice(
      `Production runs ${deployed}, which is main's code: every commit after it up to main's tip ${tip} skips CI ([skip ci] or the like); nothing to deploy.`,
    );
  }
  const judged = candidate === tip ? `main's tip ${tip}` : `${candidate} (the newest commit under main's tip ${tip} that does not skip CI)`;

  // Row 5.
  if (facts.running?.byHand) {
    return notice(`A run by hand (${facts.running.url}) is still in progress on main; this check does nothing.`);
  }
  if (facts.running) {
    return notice(`Run ${facts.running.url} for ${judged} is still in progress; this check does nothing.`);
  }
  // Row 6.
  if (facts.rollback) {
    return notice(
      `A deploy by hand (run ${facts.rollback.url}, ${facts.rollback.createdAt}) ran after ${judged} landed on main; production stays on ${deployed} until the next push to main that runs CI (a code merge).`,
    );
  }
  // Rows 7-13.
  const newest = facts.newest;
  switch (newest?.outcome) {
    case 'red':
      return notice(`${judged} failed its tests in run ${newest.url}; not testing it again. The next push to main that runs CI deploys.`);
    case 'deployed':
      return warning(
        `Run ${newest.url} deployed ${judged}, but production now runs the older ${deployed}: production was changed by hand. Not deploying; a person should check production.`,
      );
    case 'deploy-failed':
      return warning(`The deploy of ${judged} failed in run ${newest.url}; not deploying it again. A person re-runs it (README, Deploy).`);
    case 'cancelled-by-group':
      return notice(
        `The deploy of ${judged} was replaced in the deploy-prod group in run ${newest.url}; production runs the older ${deployed}. Testing and deploying ${tip}.`,
        true,
      );
    case 'cancelled':
      return notice(
        `The test or deploy of ${judged} was cancelled in run ${newest.url}, not by the deploy-prod group, so on purpose; not deploying. The next push to main that runs CI deploys.${
          newest.note ? ` The cancelled deploy's annotations: "${newest.note}".` : ''
        }`,
      );
    case undefined:
      if (facts.pushRunsOfCandidate > 0) {
        return warning(
          `None of the runs of ${judged} on main tested and deployed it, yet production runs the older ${deployed}: production moved off it some other way. Not deploying; a person should check production.`,
        );
      }
      return notice(`No push to main ran CI for ${judged}; production runs the older ${deployed}. Testing and deploying ${tip}.`, true);
    default:
      throw new Error(`Unknown outcome: ${newest?.outcome}`);
  }
}

const WORKFLOW_RUNS = '/actions/workflows/ci.yml/runs';

/**
 * Every page of one runs list (per_page=100), at most MAX_PAGES pages, else an error.
 * @param {Api} api
 * @param {string} query
 * @returns {Promise<Run[]>}
 */
async function allRuns(api, query) {
  /** @type {Run[]} */
  const runs = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { workflow_runs: batch } = await api(`${WORKFLOW_RUNS}?${query}&per_page=100&page=${page}`);
    runs.push(...batch);
    if (batch.length < 100) return runs;
  }
  throw new Error(`More than ${MAX_PAGES} pages of runs for ${query}`);
}

/** When a run's latest attempt started: a re-run moves it, its creation does not. */
const startedAt = (/** @type {Run} */ run) => Date.parse(run.run_started_at ?? run.created_at);
/** Newest first, by latest attempt. */
const byNewest = (/** @type {Run} */ a, /** @type {Run} */ b) => startedAt(b) - startedAt(a);

/**
 * Everything decide() needs, read in the matrix's order and only as far as
 * needed. Reads the API only when the tip is newer than production and some
 * commit since production does not skip CI.
 * @param {{ tip: string, deployed: string, runId: number, git: Git, api: Api }} input
 * @returns {Promise<Facts>}
 */
export async function gatherFacts({ tip, deployed: rawDeployed, runId, git, api }) {
  if (!SHA.test(tip) || !git.isCommit(tip)) throw new Error(`main's tip is not a commit: ${tip}`);
  const deployed = SHA.test(rawDeployed) && git.isCommit(rawDeployed) ? rawDeployed : '';
  /** @type {Facts} */
  const facts = {
    tip,
    deployed,
    rawDeployed,
    relation: 'unknown',
    candidate: null,
    pushRunsOfCandidate: 0,
    running: null,
    rollback: null,
    newest: null,
  };
  if (!deployed) return facts;
  if (deployed === tip) return { ...facts, relation: 'equal' };
  if (git.isAncestor(tip, deployed)) return { ...facts, relation: 'tip-older' };
  if (!git.isAncestor(deployed, tip)) return { ...facts, relation: 'unrelated' };

  // S, newest first. C is its newest commit without a skip token.
  const commits = git.firstParentLog(deployed, tip);
  if (commits[0]?.sha !== tip) throw new Error(`No first-parent history from ${deployed} to ${tip}`);
  const index = commits.findIndex((commit) => !hasSkipToken(commit.message));
  if (index < 0) return { ...facts, relation: 'tip-newer' };
  const candidate = /** @type {Commit} */ (commits[index]).sha;
  const tipToCandidate = commits.slice(0, index + 1).map((commit) => commit.sha);
  const judging = { ...facts, relation: /** @type {Relation} */ ('tip-newer'), candidate };

  // (a) C's push runs on main.
  /** @type {Run[]} */
  const pushRuns = (await api(`${WORKFLOW_RUNS}?event=push&branch=main&head_sha=${candidate}&per_page=100`)).workflow_runs
    .filter((/** @type {Run} */ run) => run.event === 'push' && run.head_branch === 'main' && run.head_sha === candidate)
    .sort(byNewest);
  judging.pushRunsOfCandidate = pushRuns.length;

  // (b) Scheduled runs of T down to C, the current run excluded: the recent
  // ones, for one still in progress; every failed, timed-out or cancelled one,
  // for rows 7-11. No-op scheduled runs conclude `success`, so they never fill
  // those.
  const scheduledOf = (/** @type {Run} */ run, /** @type {string} */ sha) =>
    run.id !== runId && run.event === 'schedule' && run.head_branch === 'main' && run.head_sha === sha;
  /** @type {Run[]} */
  const recentScheduled = [];
  /** @type {Run[]} */
  const endedScheduled = [];
  for (const sha of tipToCandidate) {
    const query = `event=schedule&branch=main&head_sha=${sha}`;
    const recent = (await api(`${WORKFLOW_RUNS}?${query}&per_page=${RECENT_SCHEDULED}`)).workflow_runs;
    recentScheduled.push(...recent.filter((/** @type {Run} */ run) => scheduledOf(run, sha)));
    for (const status of ENDED_STATUSES) {
      endedScheduled.push(...(await allRuns(api, `${query}&status=${status}`)).filter((run) => scheduledOf(run, sha)));
    }
  }

  // Runs by hand on main (rollbacks), newest first: one still going is row 5,
  // a successful one after C landed is row 6.
  /** @type {Run[]} */
  const dispatches = (await api(`${WORKFLOW_RUNS}?event=workflow_dispatch&branch=main&per_page=100`)).workflow_runs.filter(
    (/** @type {Run} */ run) => run.event === 'workflow_dispatch' && run.head_branch === 'main',
  );

  // Row 5.
  const byHand = dispatches.find((run) => run.status !== 'completed');
  if (byHand) return { ...judging, running: { id: byHand.id, url: byHand.html_url, byHand: true } };
  const running = [...pushRuns, ...recentScheduled].sort(byNewest).find((run) => run.status !== 'completed');
  if (running) return { ...judging, running: { id: running.id, url: running.html_url, byHand: false } };

  // (d) Row 6. C landed with its earliest push run on main; with none, at its
  // committer date, which is earlier and so errs towards no deploy. Any run by
  // hand that completed since, whatever its conclusion, may have changed
  // production (a rollback whose health check failed is still live), and a
  // re-run counts from its latest attempt.
  const landed =
    pushRuns.length > 0 ? Math.min(...pushRuns.map((run) => Date.parse(run.created_at))) : Date.parse(git.committerDate(candidate));
  if (Number.isNaN(landed)) throw new Error(`No landing time for ${candidate}`);
  const rollback = dispatches
    .filter((run) => startedAt(run) > landed)
    .sort(byNewest)[0];
  if (rollback) return { ...judging, rollback: { id: rollback.id, url: rollback.html_url, createdAt: rollback.created_at } };

  // (c) Rows 7-13: the jobs of the candidate runs, newest first, up to the
  // first attempted one; annotations only for a cancelled deploy job.
  const seen = new Set();
  const candidateRuns = [...pushRuns, ...endedScheduled].sort(byNewest).filter((run) => !seen.has(run.id) && seen.add(run.id));
  for (const run of candidateRuns) {
    /** @type {Job[]} */
    const jobs = (await api(`/actions/runs/${run.id}/jobs?per_page=100`)).jobs;
    let outcome = summariseRun(run, jobs);
    let note = '';
    const deployJob = jobs.find((job) => job.name === DEPLOY_JOB);
    if (outcome === 'cancelled' && deployJob?.conclusion === 'cancelled') {
      if (typeof deployJob.id !== 'number') throw new Error(`Job ${DEPLOY_JOB} of run ${run.id} has no id`);
      /** @type {Annotation[]} */
      const annotations = await api(`/check-runs/${deployJob.id}/annotations?per_page=100`);
      outcome = summariseRun(run, jobs, annotations);
      // Quoted in row 11's notice, so a person can see why it was not attributed to the group.
      note = annotations
        .flatMap((a) => [a.title, a.message])
        .filter((text) => typeof text === 'string' && text.trim())
        .join(' | ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
    }
    if (outcome !== 'not-attempted') {
      return { ...judging, newest: { id: run.id, url: run.html_url, outcome, ...(note ? { note } : {}) } };
    }
  }
  return judging;
}

/** Escapes a workflow command's message. */
function escapeData(text) {
  return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/**
 * Decides, writes the step outputs and summary, and says why.
 * @param {Record<string, string | undefined>} env
 * @param {{ git: Git, api: Api, appendFile(path: string, text: string): void, log(line: string): void }} deps
 * @returns {Promise<Decision>}
 */
export async function main(env, deps) {
  for (const name of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_OUTPUT']) {
    if (!env[name]) throw new Error(`${name} is not set`);
  }
  const facts = await gatherFacts({
    tip: env.GITHUB_SHA ?? '',
    deployed: env.DEPLOYED ?? '',
    runId: Number(env.GITHUB_RUN_ID),
    git: deps.git,
    api: deps.api,
  });
  const decision = decide(facts);
  deps.appendFile(env.GITHUB_OUTPUT ?? '', `deploy=${decision.deploy}\ndeployed=${facts.deployed}\n`);
  deps.log(`::${decision.level} title=Deploy catch-up::${escapeData(decision.reason)}`);
  if (env.GITHUB_STEP_SUMMARY) {
    deps.appendFile(env.GITHUB_STEP_SUMMARY, `### Deploy catch-up\n\n${decision.reason}\n`);
  }
  return decision;
}

/** @returns {Git} */
export function realGit(cwd = process.cwd()) {
  const git = (/** @type {string[]} */ args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  return {
    isCommit(sha) {
      try {
        git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${sha}^{commit}`]);
        return true;
      } catch {
        return false;
      }
    },
    isAncestor(ancestor, descendant) {
      try {
        git(['merge-base', '--is-ancestor', ancestor, descendant]);
        return true;
      } catch (error) {
        // Exit 1 means "not an ancestor"; anything else is an error.
        if (/** @type {{ status?: number }} */ (error).status === 1) return false;
        throw error;
      }
    },
    firstParentLog(from, to) {
      // One NUL-terminated record per commit: the SHA, a newline, the raw message.
      return git(['log', '--first-parent', '-z', '--format=%H%n%B', `${from}..${to}`, '--'])
        .split('\0')
        .filter((record) => record.length > 0)
        .map((record) => {
          const newline = record.indexOf('\n');
          const sha = newline < 0 ? record : record.slice(0, newline);
          if (!SHA.test(sha)) throw new Error(`git log printed an odd record: ${printable(sha)}`);
          return { sha, message: newline < 0 ? '' : record.slice(newline + 1) };
        });
    },
    committerDate(sha) {
      return git(['show', '-s', '--format=%cI', sha]).trim();
    },
  };
}

/** @returns {Api} */
function realApi(env) {
  for (const name of ['GITHUB_API_URL', 'GITHUB_REPOSITORY', 'GH_TOKEN']) {
    if (!env[name]) throw new Error(`${name} is not set`);
  }
  return async (path) => {
    const url = `${env.GITHUB_API_URL}/repos/${env.GITHUB_REPOSITORY}${path}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
    return response.json();
  };
}

/**
 * The scheduled deploy's last gate, run after a green `test` and before
 * `deploy` joins `deploy-prod`: GitHub keeps one pending job per group, so a
 * deploy queued now would replace a rollback by hand still pending there, and
 * a rollback that ran during this run (even one back to the SHA `catch-up`
 * read) would be undone. So it is clear only when no `workflow_dispatch` run
 * on main is unfinished, and none started after this run did.
 * @param {Record<string, string | undefined>} env
 * @param {{ api: Api, appendFile(path: string, text: string): void, log(line: string): void }} deps
 * @returns {Promise<{ clear: boolean, reason: string }>}
 */
export async function gate(env, deps) {
  for (const name of ['GITHUB_RUN_ID', 'GITHUB_OUTPUT']) {
    if (!env[name]) throw new Error(`${name} is not set`);
  }
  /** @type {Run} */
  const self = await deps.api(`/actions/runs/${env.GITHUB_RUN_ID}`);
  const since = startedAt(self);
  if (Number.isNaN(since)) throw new Error(`Run ${env.GITHUB_RUN_ID} has no start time`);
  /** @type {Run[]} */
  const dispatches = (await deps.api(`${WORKFLOW_RUNS}?event=workflow_dispatch&branch=main&per_page=100`)).workflow_runs.filter(
    (/** @type {Run} */ run) => run.event === 'workflow_dispatch' && run.head_branch === 'main',
  );
  const blocker = dispatches
    .filter((run) => run.status !== 'completed' || startedAt(run) >= since || Date.parse(run.created_at) >= since)
    .sort(byNewest)[0];
  const result = blocker
    ? {
        clear: false,
        reason: `A run by hand on main (${blocker.html_url}, ${blocker.status}) is unfinished or started during this run; not deploying, so a rollback is never replaced or undone. The next scheduled check decides again.`,
      }
    : { clear: true, reason: 'No run by hand on main is unfinished or started during this run; deploying.' };
  deps.appendFile(env.GITHUB_OUTPUT ?? '', `clear=${result.clear}\n`);
  deps.log(`::notice title=Deploy catch-up::${escapeData(result.reason)}`);
  if (env.GITHUB_STEP_SUMMARY) deps.appendFile(env.GITHUB_STEP_SUMMARY, `### Deploy catch-up\n\n${result.reason}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const deps = { appendFile: appendFileSync, log: (/** @type {string} */ line) => console.log(line) };
    if (process.argv[2] === 'gate') await gate(process.env, { ...deps, api: realApi(process.env) });
    else await main(process.env, { ...deps, git: realGit(), api: realApi(process.env) });
  } catch (error) {
    console.log(`::error title=Deploy catch-up::${escapeData(String(error instanceof Error ? error.message : error))}`);
    process.exitCode = 1;
  }
}
