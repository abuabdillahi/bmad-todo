export const APP_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type AppEnv = (typeof APP_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Config {
  appEnv: AppEnv;
  port: number;
  databasePath: string;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): value is T {
  return value !== undefined && (allowed as readonly string[]).includes(value);
}

/**
 * Reads and validates the API's configuration from environment variables
 * (AD-16). Throws a ConfigError naming every invalid variable.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const problems: string[] = [];

  const appEnv = env.APP_ENV;
  if (!oneOf(appEnv, APP_ENVS)) {
    problems.push(`APP_ENV must be one of ${APP_ENVS.join(', ')} (got ${JSON.stringify(appEnv)})`);
  }

  const portText = env.PORT;
  const port = Number(portText);
  if (portText === undefined || !/^\d+$/.test(portText) || port < 1 || port > 65535) {
    problems.push(`PORT must be an integer from 1 to 65535 (got ${JSON.stringify(portText)})`);
  }

  const databasePath = env.DATABASE_PATH;
  if (databasePath === undefined || databasePath.trim() === '') {
    problems.push('DATABASE_PATH must be a file path');
  }

  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!oneOf(logLevel, LOG_LEVELS)) {
    problems.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} (got ${JSON.stringify(logLevel)})`);
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    appEnv: appEnv as AppEnv,
    port,
    databasePath: databasePath as string,
    logLevel: logLevel as LogLevel,
  };
}
