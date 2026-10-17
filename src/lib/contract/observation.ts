export type WebhookObservation = {
  kind: "workflow_run" | "check_run" | "status" | "pull_request";
  repository: string;
  sha: string;
  context: string | null;
  state: string;
  at: string;
  sender: { id: string; login: string; bot: boolean };
};

const SHA = /^[0-9a-f]{40}$/;
const STATE = /^[a-z_]{1,32}$/;
const AT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

type Kind = WebhookObservation["kind"];
type Mapped = { sha: string; context: string | null; state: string; at: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKind(eventName: string): eventName is Kind {
  return (
    eventName === "workflow_run" ||
    eventName === "check_run" ||
    eventName === "status" ||
    eventName === "pull_request"
  );
}

function senderOf(value: unknown): WebhookObservation["sender"] | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "number" || !Number.isInteger(value.id)) return null;
  if (typeof value.login !== "string") return null;
  return { id: String(value.id), login: value.login, bot: value.type === "Bot" };
}

function repositoryOf(value: unknown): string | null {
  if (!isRecord(value) || typeof value.full_name !== "string") return null;
  return value.full_name;
}

function requiredContext(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

function mapStatus(payload: Record<string, unknown>): Mapped | null {
  const context = requiredContext(payload.context);
  if (typeof payload.sha !== "string" || context === null || typeof payload.state !== "string") return null;
  if (typeof payload.updated_at !== "string") return null;
  return { sha: payload.sha, context, state: payload.state, at: payload.updated_at };
}

function mapCheckRun(payload: Record<string, unknown>): Mapped | null {
  if (!isRecord(payload.check_run)) return null;
  const run = payload.check_run;
  const context = requiredContext(run.name);
  const state = typeof run.conclusion === "string" ? run.conclusion : run.status;
  const at = typeof run.completed_at === "string" ? run.completed_at : run.started_at;
  if (typeof run.head_sha !== "string" || context === null || typeof state !== "string" || typeof at !== "string") {
    return null;
  }
  return { sha: run.head_sha, context, state, at };
}

function mapWorkflowRun(payload: Record<string, unknown>): Mapped | null {
  if (!isRecord(payload.workflow_run)) return null;
  const run = payload.workflow_run;
  const context = requiredContext(run.name);
  const state = typeof run.conclusion === "string" ? run.conclusion : run.status;
  if (typeof run.head_sha !== "string" || context === null || typeof state !== "string") return null;
  if (typeof run.updated_at !== "string") return null;
  return { sha: run.head_sha, context, state, at: run.updated_at };
}

function mapPullRequest(payload: Record<string, unknown>): Mapped | null {
  if (!isRecord(payload.pull_request)) return null;
  const pullRequest = payload.pull_request;
  if (!isRecord(pullRequest.head) || typeof pullRequest.head.sha !== "string") return null;
  const state = pullRequest.merged === true ? "merged" : pullRequest.state;
  if (typeof state !== "string" || typeof pullRequest.updated_at !== "string") return null;
  return { sha: pullRequest.head.sha, context: null, state, at: pullRequest.updated_at };
}

function accept(mapped: Mapped): Mapped | null {
  if (!SHA.test(mapped.sha) || !STATE.test(mapped.state)) return null;
  if (!AT.test(mapped.at) || Number.isNaN(Date.parse(mapped.at))) return null;
  return mapped;
}

export function parseWebhookObservation(eventName: string, payload: unknown): WebhookObservation | null {
  if (!isKind(eventName) || !isRecord(payload)) return null;
  const repository = repositoryOf(payload.repository);
  const sender = senderOf(payload.sender);
  if (repository === null || sender === null) return null;

  const mapped =
    eventName === "status"
      ? mapStatus(payload)
      : eventName === "check_run"
        ? mapCheckRun(payload)
        : eventName === "workflow_run"
          ? mapWorkflowRun(payload)
          : mapPullRequest(payload);
  if (mapped === null) return null;
  const accepted = accept(mapped);
  if (accepted === null) return null;

  return {
    kind: eventName,
    repository,
    sha: accepted.sha,
    context: accepted.context,
    state: accepted.state,
    at: accepted.at,
    sender,
  };
}
