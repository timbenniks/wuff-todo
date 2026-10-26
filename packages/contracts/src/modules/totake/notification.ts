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
/** Items actually due for this send; a normal repeat may already be planned later. */
export function notificationDueItems(group: Occurrence, now: number) {
  return group.items.filter(
    (i) =>
      !group.records.some((r) => r.itemId === i.id) &&
      (group.reminders[i.id]?.nextInstant ?? i.alertInstant ?? Infinity) <=
        now &&
      (group.reminders[i.id]?.snoozedInstant ?? -Infinity) <= now,
  );
}
function actionableItems(group: Occurrence, now: number) {
  return group.items.filter(
    (i) =>
      !group.records.some((r) => r.itemId === i.id) &&
      (i.alertInstant ?? Infinity) <= now &&
      (group.reminders[i.id]?.snoozedInstant ?? -Infinity) <= now,
  );
}
export function totakeNotificationContent(
  state: State,
  group: Occurrence,
  showContent: boolean,
  now: number,
) {
  const items = notificationDueItems(group, now);
  const at = Math.min(...items.map((i) => i.alertInstant ?? Infinity));
  const time = Number.isFinite(at)
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: state.clock!.zone,
      }).format(new Date(at))
    : "";
  return {
    title: `${items.length} ${items.length === 1 ? "reminder" : "reminders"}${time ? ` at ${time}` : ""}`,
    body: showContent
      ? items
          .map((i) => `${i.name} · ${i.dose}`)
          .join("\n")
          .slice(0, 1000)
      : "Open Wuff to view your reminder.",
  };
}
export function makeTotakeNotification(
  state: State,
  group: Occurrence,
  userId: string,
  deviceId: string,
  showContent: boolean,
  now: number,
): TotakeNotification {
  const items = notificationDueItems(group, now);
  const eligible = actionableItems(group, now);
  const item = items[0];
  if (
    !showContent ||
    !item ||
    items.length > 100 ||
    items.length !== eligible.length ||
    !items.every((i) => eligible.some((e) => e.id === i.id))
  )
    return { userId, groupId: group.id };
  const selection = items.map((i) => ({
    itemId: i.id,
    identity: notificationItemIdentity(group, i),
    lastAuditId: notificationHistory(state, group.id, i.id),
  }));
  // Bound the serialized request below the adapters' 128 KiB envelope, even for multibyte names.
  const direct: TotakeNotificationContext = {
    userId,
    deviceId,
    groupId: group.id,
    ...selection[0],
    ...(selection.length > 1 ? { items: selection } : {}),
    issuedAt: now,
    expiresAt: now + notificationActionLifetime,
  };
  if (JSON.stringify(direct).length > 30000)
    return { userId, groupId: group.id };
  return { userId, groupId: group.id, kind: item.kind, direct };
}
/** Stay below Web Push's 3993-byte plaintext ceiling (RFC 8291 §4).
 * Large selections use review instead of silently losing the entire notification.
 */
export function fitTotakePushPayload<
  T extends { body: string; totake?: TotakeNotification },
>(payload: T): T {
  const next = {
    ...payload,
    ...(payload.totake ? { totake: { ...payload.totake } } : {}),
  };
  const size = () => new TextEncoder().encode(JSON.stringify(next)).length;
  if (size() > 3500 && next.totake) delete next.totake.direct;
  const text = Array.from(next.body);
  while (size() > 3500 && text.length) {
    text.splice(Math.max(0, text.length - 32));
    next.body = text.join("") + "…";
  }
  return next;
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
  const selection = context.items ?? [
    {
      itemId: context.itemId,
      identity: context.identity,
      lastAuditId: context.lastAuditId,
    },
  ];
  if (
    context.items &&
    (selection.length < 2 ||
      selection.length > 100 ||
      new Set(selection.map((i) => i.itemId)).size !== selection.length ||
      context.itemId !== selection[0].itemId ||
      context.identity !== selection[0].identity ||
      context.lastAuditId !== selection[0].lastAuditId)
  )
    throw Error(
      "The notification selection changed. Open the reminder to review it.",
    );
  if (
    !(
      change.action === "record" &&
      (change.outcome === "taken" ||
        (!!context.items && change.outcome === "skipped"))
    ) &&
    change.action !== "snooze"
  )
    throw Error("Use Totake to review this action.");
  if (context.items && change.action === "snooze" && change.minutes !== 30)
    throw Error("Use Totake to choose another snooze duration.");
  if (
    !("groupId" in change) ||
    change.groupId !== context.groupId ||
    !("itemIds" in change) ||
    change.itemIds.length !== selection.length ||
    new Set(change.itemIds).size !== selection.length ||
    !selection.every((i) => change.itemIds.includes(i.itemId))
  )
    throw Error(
      "The notification selection changed. Open the reminder to review it.",
    );
  const group = state.groups.find((g) => g.id === context.groupId);
  const eligible = group ? actionableItems(group, now) : [];
  if (
    !group ||
    eligible.length !== selection.length ||
    selection.some((entry) => {
      const item = eligible.find((i) => i.id === entry.itemId);
      return (
        !item ||
        notificationItemIdentity(group, item) !== entry.identity ||
        notificationHistory(state, group.id, item.id) !== entry.lastAuditId
      );
    })
  )
    throw Error(
      "This reminder changed. Open Totake to review before recording.",
    );
}
