import { describe, expect, it } from "vitest";
import { groupLinkRequests, type LinkRequestView } from "@/lib/link-requests/groups";

function view(overrides: Pick<LinkRequestView, "id" | "state"> & Partial<LinkRequestView>): LinkRequestView {
  return {
    repository: "fixture-ut/alpha",
    ownerGithubId: "800001",
    proposedKey: "LINKUT-ALPHA",
    engineVersion: "0.2.9",
    contractVersion: "0-draft-3",
    projectKey: null,
    firstRequestedAt: "2026-10-01T00:00:00.000Z",
    lastRequestedAt: "2026-10-01T00:00:00.000Z",
    decidedAt: null,
    ...overrides,
  };
}

describe("groupLinkRequests", () => {
  it("splits three groups, newest first, with ties by id ascending", () => {
    const pendingNewer = view({ id: "p2", state: "pending", lastRequestedAt: "2026-10-03T00:00:00.000Z" });
    const pendingMiddle = view({ id: "p1", state: "pending", lastRequestedAt: "2026-10-02T00:00:00.000Z" });
    const pendingTieB = view({ id: "p0b", state: "pending", lastRequestedAt: "2026-10-01T00:00:00.000Z" });
    const pendingTieA = view({ id: "p0a", state: "pending", lastRequestedAt: "2026-10-01T00:00:00.000Z" });
    const linkedNewer = view({
      id: "l2",
      state: "approved",
      decidedAt: "2026-10-20T00:00:00.000Z",
      lastRequestedAt: "2026-10-01T00:00:00.000Z",
      projectKey: "LINKUT-NEW",
    });
    const linkedTieB = view({
      id: "l0b",
      state: "approved",
      decidedAt: "2026-10-10T00:00:00.000Z",
      lastRequestedAt: "2026-10-09T00:00:00.000Z",
      projectKey: "LINKUT-B",
    });
    const linkedTieA = view({
      id: "l0a",
      state: "approved",
      decidedAt: "2026-10-10T00:00:00.000Z",
      lastRequestedAt: "2026-10-08T00:00:00.000Z",
      projectKey: "LINKUT-A",
    });
    const declinedNewer = view({ id: "d2", state: "declined", decidedAt: "2026-10-18T00:00:00.000Z" });
    const declinedTieB = view({ id: "d0b", state: "declined", decidedAt: "2026-10-05T00:00:00.000Z" });
    const declinedTieA = view({ id: "d0a", state: "declined", decidedAt: "2026-10-05T00:00:00.000Z" });
    const input = Object.freeze([
      pendingTieB,
      linkedTieB,
      declinedTieB,
      pendingNewer,
      linkedNewer,
      declinedNewer,
      pendingMiddle,
      linkedTieA,
      declinedTieA,
      pendingTieA,
    ]);

    const groups = groupLinkRequests(input);

    expect(groups.pending).toEqual([pendingNewer, pendingMiddle, pendingTieA, pendingTieB]);
    expect(groups.linked).toEqual([linkedNewer, linkedTieA, linkedTieB]);
    expect(groups.declined).toEqual([declinedNewer, declinedTieA, declinedTieB]);
    expect(input.map((row) => row.id)).toEqual([
      "p0b",
      "l0b",
      "d0b",
      "p2",
      "l2",
      "d2",
      "p1",
      "l0a",
      "d0a",
      "p0a",
    ]);
  });

  it("keeps a declined row with a project key in Declined", () => {
    const declined = view({
      id: "d1",
      state: "declined",
      projectKey: "LINKUT-KEEP",
      decidedAt: "2026-10-18T00:00:00.000Z",
    });
    const pending = view({ id: "p1", state: "pending" });
    const linked = view({
      id: "l1",
      state: "approved",
      projectKey: "LINKUT-LIVE",
      decidedAt: "2026-10-19T00:00:00.000Z",
    });

    const groups = groupLinkRequests([declined, pending, linked]);

    expect(groups.declined).toEqual([declined]);
    expect(groups.declined[0]?.projectKey).toBe("LINKUT-KEEP");
    expect(groups.pending).toEqual([pending]);
    expect(groups.linked).toEqual([linked]);
  });

  it("returns three empty groups and leaves the input unchanged", () => {
    const input: LinkRequestView[] = [];
    Object.freeze(input);

    expect(groupLinkRequests(input)).toEqual({ pending: [], linked: [], declined: [] });
    expect(input).toEqual([]);
  });
});
