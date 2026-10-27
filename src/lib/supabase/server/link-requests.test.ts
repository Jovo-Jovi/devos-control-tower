import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { linkOutcome, approveLinkRequest, declineLinkRequest, deleteLinkRequest, exportLinkRequest } = await import(
  "./link-requests"
);
const { createAdminClient } = await import("./admin");

const REPOS = ["fixture-ut/alpha", "fixture-ut/bravo", "fixture-ut/taken"] as const;
const KEYS = ["LINKUT-ALPHA", "LINKUT-BRAVO", "LINKUT-TAKEN", "LINKUT-OTHER"] as const;

let admin: ReturnType<typeof createAdminClient>;
let alphaId = "";
let bravoId = "";
let takenId = "";

async function removeFixtures(): Promise<void> {
  const requests = await admin.from("link_requests").delete().in("repository", [...REPOS]);
  if (requests.error) throw new Error(requests.error.code ?? "delete-requests");
  const byKey = await admin.from("projects").delete().in("key", [...KEYS]);
  if (byKey.error) throw new Error(byKey.error.code ?? "delete-projects");
  const byRepo = await admin.from("projects").delete().in("repo", [...REPOS]);
  if (byRepo.error) throw new Error(byRepo.error.code ?? "delete-repos");
}

async function insertRequest(repository: string, proposedKey: string): Promise<string> {
  const { data, error } = await admin
    .from("link_requests")
    .insert({
      repository,
      owner_github_id: "800001",
      proposed_key: proposedKey,
      engine_version: "0.2.9",
      contract_version: "0-draft-3",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.code ?? "insert-request");
  return data.id;
}

describe("linkOutcome", () => {
  it("maps an error, a non-object and a disallowed result to failed with no other field", () => {
    const cases: { action: "approve" | "decline" | "delete" | "export"; data: unknown; error: unknown }[] = [
      { action: "approve", data: { result: "approved", key: "LINKUT-ALPHA" }, error: { code: "XX000" } },
      { action: "approve", data: null, error: null },
      { action: "approve", data: [], error: null },
      { action: "approve", data: { result: "linked" }, error: null },
      { action: "approve", data: { result: "approved", key: "lower" }, error: null },
      { action: "delete", data: { result: "deleted" }, error: null },
      { action: "delete", data: { result: "deleted", project_deleted: "yes" }, error: null },
    ];

    for (const entry of cases) {
      expect(linkOutcome(entry.action, { data: entry.data, error: entry.error })).toEqual({ kind: "failed" });
    }
  });

  it("maps an approve result of project_linked to its own outcome", () => {
    expect(linkOutcome("approve", { data: { result: "project_linked" }, error: null })).toEqual({
      kind: "project_linked",
    });
  });
});

describe("link request functions", () => {
  beforeAll(async () => {
    admin = createAdminClient();
    await removeFixtures();
    const { error } = await admin.from("projects").insert({
      key: "LINKUT-OTHER",
      repo: "fixture-ut/taken",
      owner_github_id: "800099",
    });
    if (error) throw new Error(error.code ?? "insert-project");
    alphaId = await insertRequest("fixture-ut/alpha", "LINKUT-ALPHA");
    bravoId = await insertRequest("fixture-ut/bravo", "LINKUT-BRAVO");
    takenId = await insertRequest("fixture-ut/taken", "LINKUT-TAKEN");
  });

  afterAll(async () => {
    if (!admin) return;
    await removeFixtures();
  });

  it("approves with the proposed key, then reports not pending", async () => {
    expect(await approveLinkRequest(alphaId)).toEqual({ kind: "approved", key: "LINKUT-ALPHA" });
    expect(await approveLinkRequest(alphaId)).toEqual({ kind: "not_pending" });
  });

  it("refuses a repository another owner already has", async () => {
    expect(await approveLinkRequest(takenId)).toEqual({ kind: "repo_taken" });
    const project = await admin.from("projects").select("key, owner_github_id").eq("repo", "fixture-ut/taken").maybeSingle();
    if (project.error) throw new Error(project.error.code ?? "project");
    expect(project.data).toEqual({ key: "LINKUT-OTHER", owner_github_id: "800099" });
  });

  it("reports a missing request as not found", async () => {
    expect(await approveLinkRequest(crypto.randomUUID())).toEqual({ kind: "not_found" });
  });

  it("declines a pending request", async () => {
    expect(await declineLinkRequest(bravoId)).toEqual({ kind: "declined" });
  });

  it("exports the request document without a result field", async () => {
    const exported = await exportLinkRequest(bravoId);
    expect(exported.kind).toBe("exported");
    if (exported.kind !== "exported" || !exported.document || typeof exported.document !== "object" || Array.isArray(exported.document)) {
      throw new Error("exported");
    }
    expect(exported.document.request).toMatchObject({ repository: "fixture-ut/bravo" });
    expect("result" in exported.document).toBe(false);
  });

  it("deletes the approved request and its project", async () => {
    expect(await deleteLinkRequest(alphaId)).toEqual({ kind: "deleted", projectDeleted: true });
    const project = await admin.from("projects").select("id").eq("key", "LINKUT-ALPHA").maybeSingle();
    if (project.error) throw new Error(project.error.code ?? "project");
    expect(project.data).toBeNull();
  });
});
