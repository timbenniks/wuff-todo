// Waffles is a friendly companion: wordplay in the conversation, clear verbs
// on controls. Never decorate user content, permission names or machine data.
export const wuffCopy = {
  listsHeading: "Your list pack",
  archiveHeading: "Lists on paws",
  listPlaceholder: "Give your list a fetching name",
  sectionPlaceholder: "Corg-anize with a section name",
  fetchingList: "Sniffing out your list…",
  saving: "Saving, paws a moment…",
  saved: "Paw-some, saved.",
  writingPaws: "Fetching your writing paws…",
  uploadingImage: "Fetching your photo, paws a moment…",
  fetchingImage: "Sniffing out your photo…",
  sharingSaved: "Paw-some! Your pack’s sharing settings are saved.",
  savingSharing: "Getting your pack in order… Saving sharing settings.",
  savingInvitation: "Paws a moment… Saving your invitation response.",
  connectingLive: "Sniffing out live updates. Regular refresh is active.",
  liveConnected: "Pup to date · Live updates connected",
  reconnectingLive:
    "A little paws in live updates. Reconnecting; regular refresh is active.",
} as const;

export function taskCount(count: number) {
  if (count === 0) return "No tasks to fetch. Time for a little paws.";
  return `${count} ${count === 1 ? "task" : "tasks"} to fetch and finish`;
}

export function wuffError(message: string) {
  // Preserve an existing joke when an HTTP/MCP error crosses another adapter.
  // Unknown errors still get a friendly prefix without losing their meaning.
  return /^(?:Ruff|Wuff|Paws\b|Paw-some|That’s a (?:long tail|big pup)|Give it a name to bark|Your pack|Our pack|We lost the scent|A little paws|Fur-real)/.test(
    message,
  )
    ? message
    : `Ruff patch! ${message}`;
}
