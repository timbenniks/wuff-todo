
import type { GithubPullRequest } from "@wuff/contracts";

// Aggregate the latest review from each reviewer; old approvals must not hide
// a later request for changes or a dismissed review.
export function reviewState(
  reviews: { user?: { id: number }; state: string }[],
): GithubPullRequest["review"] {
  const latest = new Map<number, string>();
  for (const review of reviews)
    if (review.user && review.state !== "COMMENTED")
      latest.set(review.user.id, review.state);
  const values = [...latest.values()];
  if (values.includes("CHANGES_REQUESTED")) return "changes_requested";
  return values.includes("APPROVED") ? "approved" : "pending";
}

export function checkState(
  runs: { status: string; conclusion: string | null }[],
): GithubPullRequest["checks"] {
  if (!runs.length) return "none";
  if (
    runs.some(
      (r) =>
        r.status === "completed" &&
        !["success", "neutral", "skipped"].includes(r.conclusion ?? ""),
    )
  )
    return "failing";
  return runs.some((r) => r.status !== "completed") ? "pending" : "passing";
}
