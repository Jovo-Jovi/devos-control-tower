export type ProjectCopy = {
  eyebrow: string;
  lead: string;
  lastActivity: string;
  lastContact: string;
  phases: string;
  runs: string;
  observed: string;
  noObserved: string;
  empty: string;
  gap: string;
  running: string;
  unfinished: string;
  atRange: string;
  seq: string;
  legend: string;
  usage: string;
  unknown: string;
  ci: string;
  local: string;
  imported: string;
  fresh: string;
  stale: string;
  noContact: string;
  unavailable: string;
  error: string;
};

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");
}

export function executionWord(copy: ProjectCopy, source: string): string {
  if (source === "ci") return copy.ci;
  if (source === "local") return copy.local;
  if (source === "import") return copy.imported;
  return copy.unknown;
}
