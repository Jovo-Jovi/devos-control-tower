export type LinkRequestBody = { v: 1; key: string; engine: string; contract: string };

const FIELDS = ["v", "key", "engine", "contract"] as const;
const KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;
const PRINTABLE = /^[!-~]{1,32}$/;
const REPOSITORY = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const OWNER_ID = /^[0-9]{1,20}$/;

function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== "string" || !pattern.test(value)) return null;
  return value;
}

export function parseLinkRequestBody(value: unknown): LinkRequestBody | null {
  if (!plain(value)) return null;
  if (Object.keys(value).length !== FIELDS.length) return null;
  for (const field of FIELDS) {
    if (!Object.hasOwn(value, field)) return null;
  }
  if (value.v !== 1) return null;
  const key = text(value.key, KEY);
  const engine = text(value.engine, PRINTABLE);
  const contract = text(value.contract, PRINTABLE);
  if (key === null || engine === null || contract === null) return null;
  return { v: 1, key, engine, contract };
}

export function linkClaimsValid(repository: string, repositoryOwnerId: string): boolean {
  return REPOSITORY.test(repository) && OWNER_ID.test(repositoryOwnerId);
}
