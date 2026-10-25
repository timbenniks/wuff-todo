
import type { State, Item, AuditEntry } from "./model";
import { newTreatment, type SetupDraft } from "./treatments";
import { amount, deduct, restore } from "./stock";
import { resolveWall, wallAt } from "./timeZone";
import { isoDay } from "./calendar";
import { fromISO, minute } from "./treatments";
import { time } from "./model";

export type Intake = {
  id: string;
  item: Item;
  at: number;
  atInstant?: number;
  zone?: string;
  note: string;
  createdAt: number;
  undone?: boolean;
};
export type IntakeDraft = {
  id: string;
  medicationId: string;
  medication: SetupDraft;
  quantity: string;
  strength: string;
  note: string;
  day: string;
  dateText?: string;
  time: string;
  fold: "first" | "second";
  initialWall: number;
  initialInstant?: number;
};
export function newIntake(s: State): IntakeDraft {
  return {
    id: crypto.randomUUID(),
    medicationId: "",
    medication: {
      ...newTreatment(
        "medication",
        "custom",
        Math.floor(s.now / 1440),
        s.defaultRepeat,
      ),
      schedule: "prn",
    },
    quantity: "1",
    strength: "",
    note: "",
    day: isoDay(Math.floor(s.now / 1440)),
    time: time(s.now),
    fold:
      s.clock && resolveWall(s.now, s.clock.zone).instant < s.clock.instant
        ? "second"
        : "first",
    initialWall: s.now,
    initialInstant: s.clock?.instant,
  };
}
export function intakeWall(d: IntakeDraft) {
  return fromISO(d.day) * 1440 + minute(d.time);
}
export function intakeInstant(s: State, d: IntakeDraft) {
  const wall = intakeWall(d);
  if (
    !Number.isInteger(wall) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(d.day) ||
    isoDay(fromISO(d.day)) !== d.day ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)
  )
    throw Error("Enter a valid date in DD-MM-YYYY and time in HH:mm.");
  if (!s.clock) {
    if (wall > s.now) throw Error("Choose now or an earlier intake time.");
    return undefined;
  }
  const resolved = resolveWall(wall, s.clock.zone);
  if (resolved.gap)
    throw Error(
      "This time did not exist in the selected time zone. Enter the actual local intake time after the clock change.",
    );
  let instant =
    wall === d.initialWall &&
    d.initialInstant !== undefined &&
    wallAt(d.initialInstant, s.clock.zone) === wall
      ? d.initialInstant
      : resolved.instant;
  if (resolved.fold) {
    instant = resolved.instant;
    if (d.fold === "second") {
      for (let n = 1; n <= 180; n++)
        if (wallAt(resolved.instant + n * 60000, s.clock.zone) === wall) {
          instant = resolved.instant + n * 60000;
          break;
        }
    }
  }
  if (instant > s.clock.instant)
    throw Error("Choose now or an earlier intake time.");
  return instant;
}
export function validateIntakeDetails(t: SetupDraft) {
  if (!t.name.trim() || t.name.trim().length > 180)
    throw Error("Enter a medication name within 180 characters.");
  if (
    !t.form.trim() ||
    !t.unit.trim() ||
    t.form.length > 60 ||
    t.unit.length > 60
  )
    throw Error("Choose a form and dose unit, or enter your own.");
  if (t.detail.length > 80) throw Error("Keep strength within 80 characters.");
}
export function recordIntake(s: State, d: IntakeDraft): State {
  // The operation ID survives failures and Undo. A deliberate next intake gets a new ID.
  if (s.intakes?.some((r) => r.id === d.id)) return s;
  amount(d.quantity, true);
  if (d.strength.length > 80 || d.note.length > 500)
    throw Error(
      "Keep strength within 80 characters and the note within 500 characters.",
    );
  const atInstant = intakeInstant(s, d),
    at = intakeWall(d);
  let medication = s.treatments?.find((t) => t.id === d.medicationId),
    next = s;
  if (d.medicationId) {
    if (
      !medication ||
      medication.kind !== "medication" ||
      medication.schedule !== "prn"
    )
      throw Error("Choose a registered as-needed medication again.");
  } else {
    validateIntakeDetails(d.medication);
    if (s.treatments?.some((t) => t.id === d.medication.id))
      throw Error(
        "This medication already exists. Choose it from the registered list.",
      );
    const {
      groupIntervals: _,
      groupEdits: __,
      startDateText: ___,
      ...input
    } = d.medication;
    medication = {
      ...input,
      name: input.name.trim(),
      kind: "medication",
      schedule: "prn",
      inventory: { ...input.inventory, enabled: false },
      slots: input.slots.map((x) => ({ ...x })),
      startDay: Math.floor(s.now / 1440),
    };
    next = { ...s, treatments: [...(s.treatments ?? []), medication] };
  }
  const item: Item = {
    id: `intake-item-${d.id}`,
    name: medication!.name,
    kind: "medication",
    treatmentId: medication!.id,
    quantity: d.quantity,
    unit: medication!.unit,
    dose: `${d.quantity} ${medication!.unit}${d.strength.trim() ? " · " + d.strength.trim() : ""}`,
  };
  const entry: Intake = {
    id: d.id,
    item,
    at,
    atInstant,
    zone: s.clock?.zone,
    note: d.note.trim(),
    createdAt: s.now,
  };
  const audit: AuditEntry = {
    id: `audit-intake-${d.id}`,
    recordId: d.id,
    at: s.now,
    atInstant: s.clock?.instant,
    zone: s.clock?.zone,
    action: "record",
    groupId: `intake-${d.id}`,
    itemId: item.id,
    outcome: "taken",
    itemName: item.name,
    dose: item.dose,
  };
  next = {
    ...next,
    intakes: [...(s.intakes ?? []), entry],
    audit: [...s.audit, audit],
  };
  return deduct(next, item, d.id, `intake-${d.id}`);
}
export function undoIntake(s: State, id: string): State {
  const r = s.intakes?.find((r) => r.id === id);
  if (!r || r.undone) return s;
  return restore(
    {
      ...s,
      intakes: s.intakes!.map((x) =>
        x.id === id ? { ...x, undone: true } : x,
      ),
      audit: [
        ...s.audit,
        {
          id: `undo-intake-${id}`,
          recordId: id,
          at: s.now,
          atInstant: s.clock?.instant,
          zone: s.clock?.zone,
          action: "undo",
          groupId: `intake-${id}`,
          itemId: r.item.id,
          outcome: "taken",
          itemName: r.item.name,
          dose: r.item.dose,
        },
      ],
    },
    id,
  );
}
