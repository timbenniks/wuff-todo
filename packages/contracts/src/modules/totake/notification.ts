import type { State, Occurrence, Item } from "./engine/model";
import type { TotakeAction, TotakeNotificationContext } from "./index";
export const notificationActionLifetime = 60 * 60 * 1000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validTotakeGroupId(value: string) {
  const m = /^(\d{1,5})-(\d{1,4})(?:@(\d{1,16}))?$/.exec(value);
  return (
    !!m &&
    Number(m[1]) <= 84000 &&
    Number(m[2]) < 1440 &&
    (!m[3] || Number.isSafeInteger(Number(m[3])))
  );
}
export function totakeReminderPath(
  groupId: string,
  userId: string,
  snooze = false,
) {
  return `/totake?${new URLSearchParams({ reminder: groupId, account: userId, ...(snooze ? { intent: "snooze" } : {}) })}`;
}
export function safeNotificationPath(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/settings/notifications";
  if (
    value === "/lists" ||
    /^\/tasks\/[a-f0-9-]{36}$/.test(value) ||
    value === "/totake"
  )
    return value;
  if (!value.startsWith("/totake?")) return "/settings/notifications";
  const url = new URL(value, "https://wuff.invalid");
  const p = url.searchParams,
    group = p.get("reminder"),
    account = p.get("account"),
    intent = p.get("intent");
  if (
    url.hash ||
    !group ||
    !validTotakeGroupId(group) ||
    (account !== null && !uuid.test(account)) ||
    (intent !== null && intent !== "snooze") ||
    [...p.keys()].some(
      (k) =>
        !["reminder", "account", "intent"].includes(k) ||
        p.getAll(k).length !== 1,
    )
  )
    return "/settings/notifications";
  return value;
}
export function notificationLink(search: string, userId: string) {
  const p = new URLSearchParams(search),
    groupId = p.get("reminder");
  if (p.has("account") && p.get("account") !== userId)
    return {
      error:
        "This reminder belongs to a different account. Sign in to that account to review it.",
    };
  return { groupId, snooze: p.get("intent") === "snooze" };
}
export function notificationItemIdentity(group: Occurrence, item: Item) {
  return JSON.stringify([
    group.id,
    group.due,
    item.id,
    item.treatmentId ?? null,
    item.name,
    item.dose,
    item.quantity,
    item.unit,
    item.kind,
    item.alertInstant ?? null,
    item.sensorInsertion ?? false,
  ]);
}
export function notificationHistory(
  state: State,
  groupId: string,
  itemId: string,
) {
  return (
    state.audit
      .filter((a) => a.groupId === groupId && a.itemId === itemId)
      .at(-1)?.id ?? null
  );
}
export type TotakeNotification = {
  userId: string;
  groupId: string;
  direct?: TotakeNotificationContext;
  kind?: "medication" | "equipment";
};
export function makeTotakeNotification(
  state: State,
  group: Occurrence,
  userId: string,
  deviceId: string,
  showContent: boolean,
  now: number,
): TotakeNotification {
  const items = group.items.filter(
    (i) => !group.records.some((r) => r.itemId === i.id),
  );
  const item = items[0];
  if (
    !showContent ||
    items.length !== 1 ||
    !item ||
    (item.alertInstant ?? Infinity) > now ||
    (group.reminders[item.id]?.snoozedInstant ?? -Infinity) > now
  )
    return { userId, groupId: group.id };
  return {
    userId,
    groupId: group.id,
    kind: item.kind,
    direct: {
      userId,
      deviceId,
      groupId: group.id,
      itemId: item.id,
      identity: notificationItemIdentity(group, item),
      lastAuditId: notificationHistory(state, group.id, item.id),
      issuedAt: now,
      expiresAt: now + notificationActionLifetime,
    },
  };
}
/** Additional precondition, never an alternative to account/scope/version/receipt checks. */
export function validateNotificationAction(
  state: State,
  change: TotakeAction,
  context: TotakeNotificationContext,
  userId: string,
  now: number,
) {
  if (
    context.userId !== userId ||
    !Number.isSafeInteger(context.issuedAt) ||
    !Number.isSafeInteger(context.expiresAt) ||
    context.expiresAt <= context.issuedAt ||
    context.issuedAt > now ||
    context.expiresAt <= now ||
    context.expiresAt > context.issuedAt + notificationActionLifetime
  )
    throw Error(
      "This notification is no longer current. Open the reminder to review it.",
    );
  if (
    !(change.action === "record" && change.outcome === "taken") &&
    change.action !== "snooze"
  )
    throw Error("Use Totake to review this action.");
  if (
    !("groupId" in change) ||
    change.groupId !== context.groupId ||
    !("itemIds" in change) ||
    change.itemIds.length !== 1 ||
    change.itemIds[0] !== context.itemId
  )
    throw Error(
      "The notification selection changed. Open the reminder to review it.",
    );
  const group = state.groups.find((g) => g.id === context.groupId);
  const item = group?.items.find((i) => i.id === context.itemId);
  if (
    !group ||
    !item ||
    group.records.some((r) => r.itemId === item.id) ||
    group.items.filter((i) => !group.records.some((r) => r.itemId === i.id))
      .length !== 1 ||
    (item.alertInstant ?? Infinity) > now ||
    (group.reminders[item.id]?.snoozedInstant ?? -Infinity) > now ||
    notificationItemIdentity(group, item) !== context.identity ||
    notificationHistory(state, group.id, item.id) !== context.lastAuditId
  )
    throw Error(
      "This reminder changed. Open Totake to review before recording.",
    );
}
