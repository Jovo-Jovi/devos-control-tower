import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("@/lib/supabase/server/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

const { projectDeletionOutcome, deleteRegisteredProject } = await import("./project-deletion");

describe("projectDeletionOutcome", () => {
  it("maps deleted, linked and not_found", () => {
    expect(projectDeletionOutcome({ data: { result: "deleted" }, error: null })).toEqual({ kind: "deleted" });
    expect(projectDeletionOutcome({ data: { result: "linked" }, error: null })).toEqual({ kind: "linked" });
    expect(projectDeletionOutcome({ data: { result: "not_found" }, error: null })).toEqual({ kind: "not_found" });
  });

  it("maps an error, null data, an array and an unknown result to failed", () => {
    expect(projectDeletionOutcome({ data: { result: "deleted" }, error: { code: "XX000" } })).toEqual({ kind: "failed" });
    expect(projectDeletionOutcome({ data: null, error: null })).toEqual({ kind: "failed" });
    expect(projectDeletionOutcome({ data: [], error: null })).toEqual({ kind: "failed" });
    expect(projectDeletionOutcome({ data: { result: "other" }, error: null })).toEqual({ kind: "failed" });
  });
});

describe("deleteRegisteredProject", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("calls delete_registered_project once with the key", async () => {
    rpc.mockResolvedValue({ data: { result: "deleted" }, error: null });
    await expect(deleteRegisteredProject("DEL-HAND")).resolves.toEqual({ kind: "deleted" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("delete_registered_project", { p_key: "DEL-HAND" });
  });

  it("returns failed when rpc rejects", async () => {
    rpc.mockRejectedValue(new Error("unavailable"));
    await expect(deleteRegisteredProject("DEL-HAND")).resolves.toEqual({ kind: "failed" });
  });
});
