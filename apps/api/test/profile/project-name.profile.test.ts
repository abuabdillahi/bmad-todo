import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * C7, AD-16: a compose command with no project name is refused, so it never
 * lands on production's project `todo`, and each environment's -p still
 * resolves to exactly its name. Reads the resolved name with the read-only
 * `docker compose config`, from a folder named `todo` as a checkout or the
 * host's ~/todo would be. It starts no containers and needs no stack.
 */

const composeFile = fileURLToPath(new URL('../../../../compose.yml', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'compose-project-name-'));
const checkout = join(scratch, 'todo');

/** The environment without anything that would pick the project, file or profiles for Compose. */
const {
  COMPOSE_PROJECT_NAME: _name,
  COMPOSE_FILE: _file,
  COMPOSE_ENV_FILES: _envFiles,
  COMPOSE_PROFILES: _profiles,
  ...cleanEnv
} = process.env;

function config(args: string[], env: NodeJS.ProcessEnv = cleanEnv) {
  return spawnSync('docker', ['compose', ...args, 'config', '--format', 'json'], {
    cwd: checkout,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function projectName(args: string[], env?: NodeJS.ProcessEnv): string {
  const result = config(args, env);
  if (result.status !== 0) throw new Error(`docker compose config failed: ${result.stderr}`);
  return (JSON.parse(result.stdout) as { name: string }).name;
}

beforeAll(() => {
  mkdirSync(checkout);
  copyFileSync(composeFile, join(checkout, 'compose.yml'));
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('profile: compose project name', () => {
  it.each([[[]], [['--profile', 'prod']], [['--profile', 'test']]])(
    'a command with no -p in a folder named todo is refused, naming the -p to pass (%j)',
    (args) => {
      const result = config(args);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      for (const flag of [/-p todo-dev\b/, /-p todo-test\b/, /-p todo(?![\w-])/]) expect(result.stderr).toMatch(flag);
    },
  );

  it.each([
    ['todo-dev', 'dev'],
    ['todo-test', 'test'],
    ['todo', 'prod'],
  ])('-p %s --profile %s uses exactly that project', (project, profile) => {
    expect(projectName(['-p', project, '--profile', profile])).toBe(project);
  });

  it('-p wins over an empty COMPOSE_PROJECT_NAME inherited from the shell', () => {
    expect(projectName(['-p', 'todo-dev'], { ...cleanEnv, COMPOSE_PROJECT_NAME: '' })).toBe('todo-dev');
  });

  it('COMPOSE_PROJECT_NAME with no -p uses exactly that project', () => {
    expect(projectName([], { ...cleanEnv, COMPOSE_PROJECT_NAME: 'todo-dev' })).toBe('todo-dev');
  });
});
