export type RegistrationValue = {
  key: string;
  repo: string;
  staleAfterMinutes: number;
};

export type RegistrationErrors = {
  key?: "key";
  repo?: "repo";
  stale?: "stale";
};

export type RegistrationResult = ({ ok: true } & RegistrationValue) | ({ ok: false } & RegistrationErrors);

const KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;
const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const STALE_MAX = 100000;

export function parseRegistration(formData: FormData): RegistrationResult {
  const key = String(formData.get("key") ?? "").trim();
  const repo = String(formData.get("repo") ?? "").trim();
  const staleText = String(formData.get("stale") ?? "").trim();
  const errors: RegistrationErrors = {};

  if (!KEY.test(key)) errors.key = "key";
  if (!REPO.test(repo)) errors.repo = "repo";

  if (!/^[0-9]+$/.test(staleText)) {
    errors.stale = "stale";
  } else {
    const stale = Number(staleText);
    if (!Number.isSafeInteger(stale) || stale < 1 || stale > STALE_MAX) errors.stale = "stale";
  }

  if (errors.key || errors.repo || errors.stale) return { ok: false, ...errors };
  return { ok: true, key, repo, staleAfterMinutes: Number(staleText) };
}
