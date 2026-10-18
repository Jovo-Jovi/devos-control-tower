import type { LinkState, PortfolioProject } from "@/lib/portfolio/aggregate";

export type OverviewCopy = {
  loading: string;
  error: string;
  register: string;
  productWord: string;
  towerTitle: string;
  live: string;
  offline: string;
  projects: string;
  fresh: string;
  staleOrSilent: string;
  lastReceived: string;
  towerState: string;
  view: string;
  map: string;
  list: string;
  filter: string;
  all: string;
  active: string;
  waiting: string;
  gate: string;
  failed: string;
  tasks: string;
  phase: string;
  ofSeen: string;
  unknown: string;
  more: string;
  ci: string;
  local: string;
  imported: string;
  cardLabel: string;
  link: Record<LinkState, string>;
  close: string;
  execution: string;
  latest: string;
  fact: string;
  recent: string;
  repository: string;
  offlineKnown: string;
  legend: string;
  system: string;
  ofTasks: string;
  activity: string;
  health: string;
  hour: string;
  deliveries: string;
  rejections: string;
  empty: string;
  unavailable: string;
  registered: string;
  freshWord: string;
  noContact: string;
};

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");
}

export function executionWord(copy: OverviewCopy, execution: PortfolioProject["execution"]): string {
  if (execution === "ci") return copy.ci;
  if (execution === "local") return copy.local;
  if (execution === "import") return copy.imported;
  return copy.unknown;
}
