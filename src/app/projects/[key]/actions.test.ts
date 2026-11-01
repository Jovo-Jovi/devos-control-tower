import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string): never => {
  throw new Error(`REDIRECT ${path}`);
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/lib/supabase/server/session", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("@/lib/supabase/server/project-deletion", () => ({
  deleteRegisteredProject: vi.fn(),
}));

const { revalidatePath } = await import("next/cache");
const { requireOwner } = await import("@/lib/supabase/server/session");
const { deleteRegisteredProject } = await import("@/lib/supabase/server/project-deletion");
const { deleteProjectAction } = await import("./actions");

const OWNER = { login: "fixture-delete-owner", avatarUrl: null, githubId: "700081" };

function form(key: FormDataEntryValue, confirmation: FormDataEntryValue): FormData {
  const formData = new FormData();
  formData.set("key", key);
  formData.set("confirmation", confirmation);
  return formData;
}

describe("deleteProjectAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOwner).mockResolvedValue(OWNER);
  });

  it("rejects when requireOwner rejects and does not call deleteRegisteredProject", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("not-owner"));
    await expect(deleteProjectAction(null, form("DEL-HAND", "DEL-HAND"))).rejects.toThrow("not-owner");
    expect(vi.mocked(deleteRegisteredProject)).not.toHaveBeenCalled();
  });

  it("refuses a key outside the project key shape and does not call deleteRegisteredProject", async () => {
    await expect(deleteProjectAction(null, form("del-hand", "del-hand"))).resolves.toEqual({ error: "not_found" });
    expect(vi.mocked(deleteRegisteredProject)).not.toHaveBeenCalled();
  });

  it("refuses a non-string key and does not call deleteRegisteredProject", async () => {
    await expect(deleteProjectAction(null, form(new File(["DEL-HAND"], "key.txt"), "DEL-HAND"))).resolves.toEqual({
      error: "not_found",
    });
    expect(vi.mocked(deleteRegisteredProject)).not.toHaveBeenCalled();
  });

  it("refuses a confirmation that is not exactly the key and does not call deleteRegisteredProject", async () => {
    for (const confirmation of ["del-hand", "DEL-HAND ", "DEL-HAN"]) {
      await expect(deleteProjectAction(null, form("DEL-HAND", confirmation))).resolves.toEqual({ error: "mismatch" });
    }
    expect(vi.mocked(deleteRegisteredProject)).not.toHaveBeenCalled();
  });

  it("refuses a non-string confirmation and does not call deleteRegisteredProject", async () => {
    await expect(deleteProjectAction(null, form("DEL-HAND", new File(["DEL-HAND"], "confirmation.txt")))).resolves.toEqual({
      error: "mismatch",
    });
    expect(vi.mocked(deleteRegisteredProject)).not.toHaveBeenCalled();
  });

  it("returns linked, not_found and failed without redirecting", async () => {
    for (const kind of ["linked", "not_found", "failed"] as const) {
      vi.mocked(deleteRegisteredProject).mockResolvedValue({ kind });
      await expect(deleteProjectAction(null, form("DEL-HAND", "DEL-HAND"))).resolves.toEqual({ error: kind });
    }
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the overview and redirects after a deletion", async () => {
    vi.mocked(deleteRegisteredProject).mockResolvedValue({ kind: "deleted" });
    await expect(deleteProjectAction(null, form("DEL-HAND", "DEL-HAND"))).rejects.toThrow("REDIRECT /?deleted=DEL-HAND");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/?deleted=DEL-HAND");
  });
});
