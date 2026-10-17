import { describe, expect, it } from "vitest";
import { parseWebhookObservation } from "./observation";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const AT = "2026-10-17T10:00:00Z";
const STARTED = "2026-10-17T09:00:00.512Z";
const OFFSET = "2026-10-17T12:00:00+02:00";

function sender(id = 2001, login = "fixture-owner", type = "User") {
  return { id, login, type };
}

function repository(fullName = "fixture-org/webhook-repo") {
  return { full_name: fullName };
}

function statusPayload() {
  return {
    sha: SHA,
    context: "devos/checks",
    state: "success",
    updated_at: AT,
    repository: repository(),
    sender: sender(),
  };
}

describe("U-T03-1 parseWebhookObservation", () => {
  it("maps a status delivery", () => {
    expect(parseWebhookObservation("status", statusPayload())).toEqual({
      kind: "status",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: "devos/checks",
      state: "success",
      at: AT,
      sender: { id: "2001", login: "fixture-owner", bot: false },
    });
  });

  it("maps a check_run with a conclusion", () => {
    expect(
      parseWebhookObservation("check_run", {
        check_run: {
          head_sha: SHA,
          name: "ci",
          conclusion: "success",
          status: "completed",
          completed_at: AT,
          started_at: STARTED,
        },
        repository: repository(),
        sender: sender(99, "fixture-bot", "Bot"),
      }),
    ).toEqual({
      kind: "check_run",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: "ci",
      state: "success",
      at: AT,
      sender: { id: "99", login: "fixture-bot", bot: true },
    });
  });

  it("maps a check_run with a null conclusion onto status and started_at", () => {
    expect(
      parseWebhookObservation("check_run", {
        check_run: {
          head_sha: SHA,
          name: "ci-running",
          conclusion: null,
          status: "in_progress",
          completed_at: null,
          started_at: STARTED,
        },
        repository: repository(),
        sender: sender(),
      }),
    ).toEqual({
      kind: "check_run",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: "ci-running",
      state: "in_progress",
      at: STARTED,
      sender: { id: "2001", login: "fixture-owner", bot: false },
    });
  });

  it("maps a workflow_run with a conclusion", () => {
    expect(
      parseWebhookObservation("workflow_run", {
        workflow_run: {
          head_sha: SHA,
          name: "devos-cycle",
          conclusion: "failure",
          status: "completed",
          updated_at: OFFSET,
        },
        repository: repository(),
        sender: sender(),
      }),
    ).toEqual({
      kind: "workflow_run",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: "devos-cycle",
      state: "failure",
      at: OFFSET,
      sender: { id: "2001", login: "fixture-owner", bot: false },
    });
  });

  it("maps a workflow_run with a null conclusion onto status", () => {
    expect(
      parseWebhookObservation("workflow_run", {
        workflow_run: {
          head_sha: SHA,
          name: "devos-cycle-wait",
          conclusion: null,
          status: "queued",
          updated_at: AT,
        },
        repository: repository(),
        sender: sender(),
      }),
    ).toEqual({
      kind: "workflow_run",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: "devos-cycle-wait",
      state: "queued",
      at: AT,
      sender: { id: "2001", login: "fixture-owner", bot: false },
    });
  });

  it("maps a merged pull_request onto state merged and a null context", () => {
    expect(
      parseWebhookObservation("pull_request", {
        pull_request: {
          head: { sha: SHA },
          merged: true,
          state: "closed",
          updated_at: AT,
        },
        repository: repository(),
        sender: sender(),
      }),
    ).toEqual({
      kind: "pull_request",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: null,
      state: "merged",
      at: AT,
      sender: { id: "2001", login: "fixture-owner", bot: false },
    });
  });

  it("maps an open pull_request onto its state", () => {
    expect(
      parseWebhookObservation("pull_request", {
        pull_request: {
          head: { sha: SHA },
          merged: false,
          state: "open",
          updated_at: AT,
        },
        repository: repository(),
        sender: sender(),
      }),
    ).toEqual({
      kind: "pull_request",
      repository: "fixture-org/webhook-repo",
      sha: SHA,
      context: null,
      state: "open",
      at: AT,
      sender: { id: "2001", login: "fixture-owner", bot: false },
    });
  });

  it("returns null for an unmapped event, a bad sha, a missing repository, a bad state, a bad at, or a missing sender", () => {
    const status = statusPayload();
    expect(parseWebhookObservation("installation", status)).toBeNull();
    expect(parseWebhookObservation("installation_repositories", status)).toBeNull();
    expect(parseWebhookObservation("ping", status)).toBeNull();
    expect(parseWebhookObservation("status", { ...status, sha: SHA.slice(0, 39) })).toBeNull();
    expect(parseWebhookObservation("status", { ...status, sha: SHA.toUpperCase() })).toBeNull();
    expect(parseWebhookObservation("status", { ...status, repository: {} })).toBeNull();
    expect(parseWebhookObservation("status", { ...status, state: 1 })).toBeNull();
    expect(parseWebhookObservation("status", { ...status, updated_at: "yesterday" })).toBeNull();
    const { sha, context, state, updated_at, repository } = status;
    expect(parseWebhookObservation("status", { sha, context, state, updated_at, repository })).toBeNull();
    expect(parseWebhookObservation("status", { ...status, context: "" })).toBeNull();
    expect(
      parseWebhookObservation("status", {
        ...status,
        sender: { id: "2001", login: "fixture-owner", type: "User" },
      }),
    ).toBeNull();
    expect(
      parseWebhookObservation("status", {
        ...status,
        sender: { id: 2001.5, login: "fixture-owner", type: "User" },
      }),
    ).toBeNull();
  });
});
