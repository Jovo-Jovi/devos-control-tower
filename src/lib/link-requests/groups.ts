export type LinkRequestState = "pending" | "approved" | "declined";

export type LinkRequestView = {
  id: string;
  repository: string;
  ownerGithubId: string;
  proposedKey: string;
  engineVersion: string;
  contractVersion: string;
  state: LinkRequestState;
  projectKey: string | null;
  firstRequestedAt: string;
  lastRequestedAt: string;
  decidedAt: string | null;
};

export type LinkRequestGroups = {
  pending: LinkRequestView[];
  linked: LinkRequestView[];
  declined: LinkRequestView[];
};

function byNewest(timeOf: (row: LinkRequestView) => string | null) {
  return (left: LinkRequestView, right: LinkRequestView): number => {
    const leftTime = timeOf(left) ?? "";
    const rightTime = timeOf(right) ?? "";
    if (leftTime !== rightTime) return leftTime < rightTime ? 1 : -1;
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  };
}

export function groupLinkRequests(rows: readonly LinkRequestView[]): LinkRequestGroups {
  const pending = rows.filter((row) => row.state === "pending").sort(byNewest((row) => row.lastRequestedAt));
  const linked = rows.filter((row) => row.state === "approved").sort(byNewest((row) => row.decidedAt));
  const declined = rows.filter((row) => row.state === "declined").sort(byNewest((row) => row.decidedAt));
  return { pending, linked, declined };
}
