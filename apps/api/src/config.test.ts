import { ConfigError, loadConfig } from './config.ts';

const valid = {
  APP_ENV: 'test',
  PORT: '3000',
  DATABASE_PATH: '/data/todos.db',
  LOG_LEVEL: 'info',
};

/** The problems loadConfig reports for an env, or a failure if it accepts it. */
function problems(env: Record<string, string | undefined>): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).problems;
  }
  throw new Error(`loadConfig accepted ${JSON.stringify(env)}`);
}

describe('loadConfig', () => {
  it('loads a valid environment', () => {
    expect(loadConfig(valid)).toEqual({
      appEnv: 'test',
      port: 3000,
      databasePath: '/data/todos.db',
      logLevel: 'info',
    });
  });

  it('defaults LOG_LEVEL to info', () => {
    expect(loadConfig({ ...valid, LOG_LEVEL: undefined }).logLevel).toBe('info');
  });

  it.each(['abc', '0', '65536', '70000', '3.5', '-1', '', undefined])('rejects PORT %j', (port) => {
    const reported = problems({ ...valid, PORT: port });
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(/^PORT /);
  });

  it.each(['1', '65535'])('accepts PORT %s', (port) => {
    expect(loadConfig({ ...valid, PORT: port }).port).toBe(Number(port));
  });

  it.each([
    ['APP_ENV', { APP_ENV: 'staging' }],
    ['APP_ENV', { APP_ENV: undefined }],
    ['LOG_LEVEL', { LOG_LEVEL: 'verbose' }],
    ['DATABASE_PATH', { DATABASE_PATH: '' }],
    ['DATABASE_PATH', { DATABASE_PATH: '  ' }],
    ['DATABASE_PATH', { DATABASE_PATH: undefined }],
  ])('names %s when it is invalid (%j)', (name, override) => {
    const reported = problems({ ...valid, ...override });
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(new RegExp(`^${name} `));
  });

  it('lists every invalid variable at once', () => {
    const error = (() => {
      try {
        loadConfig({ APP_ENV: 'nope', PORT: 'abc', DATABASE_PATH: '', LOG_LEVEL: 'loud' });
      } catch (caught) {
        return caught as ConfigError;
      }
      throw new Error('loadConfig accepted an invalid environment');
    })();

    expect(error.problems.map((problem) => problem.split(' ')[0])).toEqual([
      'APP_ENV',
      'PORT',
      'DATABASE_PATH',
      'LOG_LEVEL',
    ]);
    for (const name of ['APP_ENV', 'PORT', 'DATABASE_PATH', 'LOG_LEVEL']) {
      expect(error.message).toContain(name);
    }
  });
});
