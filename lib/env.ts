import "server-only";

export class MissingEnvError extends Error {
  constructor(public readonly name: string) {
    super(`Missing required environment variable: ${name}`);
  }
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  if (!value || value.startsWith("replace-with-")) {
    return undefined;
  }

  return value;
}

export function requireEnv(name: string): string {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new MissingEnvError(name);
  }

  return value;
}

export function getNumberEnv(name: string, fallback: number): number {
  const value = getOptionalEnv(name);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
