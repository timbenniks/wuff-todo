import { AppError } from "@wuff/contracts";

export const optionalTotakePermissions = [
  {
    scope: "totake:read",
    label: "Read Totake",
    description:
      "Read your private medications, equipment, schedules, intake history and stock.",
  },
  {
    scope: "totake:write",
    label: "Change Totake",
    description:
      "Change schedules, record or undo intakes, snooze reminders and adjust stock. Requires Read Totake.",
  },
] as const;

/** Explicit client requests stay bounded. Default connections may opt in here. */
export function optionalConsentPermissions(requestedScope: string | null) {
  return requestedScope === null ? optionalTotakePermissions : [];
}

export function approvedConsentScopes(
  requested: readonly string[],
  requestedScope: string | null,
  optionalScopes: readonly string[] = [],
) {
  const offered = optionalConsentPermissions(requestedScope);
  if (
    new Set(optionalScopes).size !== optionalScopes.length ||
    optionalScopes.some((scope) => !offered.some((p) => p.scope === scope)) ||
    (optionalScopes.includes("totake:write") &&
      !optionalScopes.includes("totake:read"))
  )
    throw new AppError(
      "invalid_scope",
      "Choose the permissions offered on this consent page.",
    );
  return [...requested, ...optionalScopes];
}
