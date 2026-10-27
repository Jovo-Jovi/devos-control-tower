import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LinkOutcome } from "@/lib/supabase/server/link-requests";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server/session", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("@/lib/supabase/server/link-requests", () => ({
  approveLinkRequest: vi.fn(),
  declineLinkRequest: vi.fn(),
  deleteLinkRequest: vi.fn(),
  exportLinkRequest: vi.fn(),
}));

const { requireOwner } = await import("@/lib/supabase/server/session");
const { approveLinkRequest, declineLinkRequest, deleteLinkRequest, exportLinkRequest } = await import(
  "@/lib/supabase/server/link-requests"
);
const {
  approveLinkRequestAction,
  declineLinkRequestAction,
  deleteLinkRequestAction,
  exportLinkRequestAction,
} = await import("./actions");

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const cases: {
  action: (id: string) => Promise<LinkOutcome>;
  server: (id: string) => Promise<LinkOutcome>;
  outcome: LinkOutcome;
}[] = [
  {
    action: approveLinkRequestAction,
    server: approveLinkRequest,
    outcome: { kind: "approved", key: "FLOW-ONE" },
  },
  {
    action: declineLinkRequestAction,
    server: declineLinkRequest,
    outcome: { kind: "declined" },
  },
  {
    action: deleteLinkRequestAction,
    server: deleteLinkRequest,
    outcome: { kind: "deleted", projectDeleted: false },
  },
  {
    action: exportLinkRequestAction,
    server: exportLinkRequest,
    outcome: { kind: "exported", document: {} },
  },
];

describe("link request actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects each action when requireOwner rejects and does not call the server function", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("not-owner"));

    for (const entry of cases) {
      await expect(entry.action(ID)).rejects.toThrow("not-owner");
      expect(vi.mocked(entry.server)).not.toHaveBeenCalled();
    }
  });

  it("calls each server function once with the id when requireOwner resolves", async () => {
    vi.mocked(requireOwner).mockResolvedValue({
      login: "fixture-actions-owner",
      avatarUrl: null,
      githubId: "1201",
    });
    for (const entry of cases) {
      vi.mocked(entry.server).mockResolvedValue(entry.outcome);
    }

    for (const entry of cases) {
      await expect(entry.action(ID)).resolves.toEqual(entry.outcome);
      expect(vi.mocked(entry.server)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(entry.server)).toHaveBeenCalledWith(ID);
    }
  });
});
