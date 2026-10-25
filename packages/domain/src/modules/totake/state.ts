import {
  totakeEngine as e,
  type TotakeAction,
  type TotakeState,
  AppError,
} from "@wuff/contracts";
const fail = (message: string): never => {
  throw new AppError("invalid_totake_action", message, 400);
};
export function emptyTotake(
  now = Date.now(),
  zone = "Europe/Paris",
): TotakeState {
  const wall = e.wallAt(now, zone),
    today = Math.floor(wall / 1440);
  return {
    now: wall,
    clock: { zone, instant: now, anchors: {} },
    treatments: [],
    groups: [],
    intakes: [],
    audit: [],
    events: [],
    timeMoves: [],
    groupOverrides: [],
    defaultRepeat: 30,
    repeatPreferences: {},
    planHorizon: today - 1,
  };
}
/** Server clock only. Reconcile expected occurrences without fabricating missed repeat sends. */
export function refreshTotake(
  state: TotakeState,
  now: number,
  throughDay?: number,
): TotakeState {
  const s = structuredClone(state),
    clock = s.clock!;
  clock.instant = now;
  s.now = e.wallAt(now, clock.zone);
  const today = Math.floor(s.now / 1440);
  const through = throughDay ?? today + 31;
  if (through > today + 366) fail("Choose a date within one year of today.");
  const next = e.reconcileClock(e.ensureDay(s, Math.max(today + 31, through)));
  for (const g of next.groups)
    for (const i of e.pending(g)) {
      const r = g.reminders[i.id];
      if ((i.alertInstant ?? Infinity) <= now) {
        r.started = true;
        r.visible = true;
      }
    }
  return next;
}
export function applyTotakeAction(
  state: TotakeState,
  action: TotakeAction,
  operationId: string,
  now: number,
): TotakeState {
  const s = refreshTotake(state, now);
  const requireGroup = (groupId: string, ids: string[]) => {
    const g = s.groups.find((g) => g.id === groupId);
    if (!g || ids.some((id) => !e.pending(g).some((i) => i.id === id)))
      fail(
        "These reminders changed. Load the latest overview before recording.",
      );
    return g!;
  };
  let next: TotakeState;
  switch (action.action) {
    case "save_treatment": {
      const old = s.treatments!.find((t) => t.id === action.draft.id);
      if (!old && s.treatments!.length >= 100)
        fail("The registered item limit is 100.");
      if (action.draft.startDay > Math.floor(s.now / 1440) + 366)
        fail("Choose a start date within one year.");
      if (
        action.draft.kind === "medication" &&
        action.draft.equipmentType !== "custom"
      )
        fail("Medication cannot be registered as equipment.");
      const draft = structuredClone(action.draft);
      draft.inventory.unit = draft.unit;
      if (draft.inventory.enabled && !e.stockEligible(draft))
        fail(
          "Stock tracking supports counted units only. Liquids and drops are not tracked.",
        );
      for (const slot of draft.slots) e.amount(slot.quantity, true);
      if (!old && Number(draft.inventory.current) < 0)
        fail("Opening stock cannot be negative.");
      if (Number(draft.inventory.threshold) < 0)
        fail("Stock threshold cannot be negative.");
      if (draft.form.length > 60 || draft.unit.length > 60)
        fail("Keep form and unit within 60 characters.");
      next = e.saveTreatment(s, draft);
      break;
    }
    case "record":
      requireGroup(action.groupId, action.itemIds);
      next = e.record(s, action.groupId, action.itemIds, action.outcome);
      break;
    case "snooze": {
      const group = requireGroup(action.groupId, action.itemIds);
      if (
        group.items.some(
          (i) =>
            action.itemIds.includes(i.id) && (i.alertInstant ?? Infinity) > now,
        )
      )
        fail(
          "Snooze is available when this reminder is due. Use Change date/time to move a future reminder.",
        );
      next = e.snooze(s, action.groupId, action.itemIds, action.minutes);
      break;
    }
    case "undo": {
      const g = s.groups.find((g) => g.id === action.groupId);
      if (!g?.records.some((r) => r.id === action.recordId))
        fail("This record has already changed. Load the latest overview.");
      next = e.undo(s, action.groupId, action.recordId);
      break;
    }
    case "record_intake":
      next = e.recordIntake(s, { ...action.draft, id: operationId });
      break;
    case "undo_intake": {
      if (!s.intakes?.some((i) => i.id === action.intakeId && !i.undone))
        fail("This intake has already changed. Load the latest overview.");
      next = e.undoIntake(s, action.intakeId);
      break;
    }
    case "adjust_stock": {
      const treatment = s.treatments!.find((t) => t.id === action.treatmentId);
      if (
        !treatment ||
        !e.stockEligible(treatment) ||
        !treatment.inventory.enabled
      )
        fail("Choose an item with count stock tracking enabled.");
      next = e.adjustStock(
        s,
        action.treatmentId,
        action.kind,
        action.quantity,
        operationId,
      );
      break;
    }
    case "move_reminder":
      requireGroup(action.groupId, [action.itemId]);
      if (action.toDue > s.now + 366 * 1440)
        fail("Choose a reminder date within one year.");
      next = e.moveReminder(
        s,
        action.groupId,
        action.itemId,
        action.toDue,
        action.scope,
        action.acceptProposal,
      );
      break;
    case "settings":
      next = e.saveDefaultRepeat(s, action.repeat);
      if (next.clock!.zone !== action.timezone)
        next = e.changeZone(next, action.timezone);
      break;
  }
  // Diagnostic event strings are not a second permanent medical history.
  return { ...next, events: [] };
}

/** Editing a definition never cancels an already-due unresolved occurrence. */
export function totakeNeedsScheduler(state: TotakeState) {
  return (
    !!state.treatments?.some((t) => t.schedule !== "prn") ||
    state.groups.some((g) => e.pending(g).length > 0)
  );
}
