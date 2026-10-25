"use client";
import { stockEligible } from "@wuff/contracts/totake/inventory";
import { DateInput } from "./DateInput";
import { displayISO } from "@wuff/contracts/totake/dateFormat";
import { useEffect, useRef, useState } from "react";
import { Button } from "@wuff/ui/button";
import { Input } from "@wuff/ui/input";
import { NativeSelect } from "@wuff/ui/native-select";
import { Modal } from "./Modal";
import { actualGroupTimes, setupGroupTimes, clock, fromISO, scheduleLabel, startDate, treatmentTimes, validateTreatment, type SetupDraft, type Treatment, type ScheduleKind, type Slot } from "@wuff/contracts/totake/treatments";
import type { State } from "@wuff/contracts/totake/model";
const steps = [
  "Name and unit",
  "Schedule",
  "Date, times and quantity",
  "Repeat reminders",
  "Optional inventory",
  "Review",
];
const basic: [ScheduleKind, string][] = [
  ["daily", "Once daily"],
  ["twice", "Twice daily"],
  ["prn", "As needed"],
];
const more: [ScheduleKind, string][] = [
  ["interval", "Interval"],
  ["multiple", "Multiple times daily"],
  ["weekdays", "Specific weekdays"],
  ["cycle", "Cyclic schedule"],
];
export function ChoiceField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const custom = !options.includes(value);
  return (
    <div className="setup-field">
      <label htmlFor={id}>{label}</label>
      <NativeSelect
        id={id}
        value={custom ? "__custom" : value}
        onChange={(e) =>
          onChange(e.target.value === "__custom" ? "" : e.target.value)
        }
      >
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
        <option value="__custom">Custom…</option>
      </NativeSelect>
      {custom && (
        <>
          <label htmlFor={id + "-custom"}>Custom {label.toLowerCase()}</label>
          <Input
            id={id + "-custom"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={60}
          />
        </>
      )}
    </div>
  );
}
export function SetupWizard({
  initial,
  state,
  original,
  onCancel,
  onFirstBack,
  onSave,
  initialDirty = false,
}: {
  initial: SetupDraft;
  state: State;
  initialDirty?: boolean;
  original?: Treatment;
  onCancel: () => void;
  onFirstBack: (draft: SetupDraft, dirty: boolean) => void;
  onSave: (draft: SetupDraft) => Promise<string | null>;
}) {
  const [d, setD] = useState(() =>
      initial.kind === "equipment" && initial.equipmentType === "sensor"
        ? {
            ...initial,
            slots: initial.slots.map((slot) => ({ ...slot, quantity: "1" })),
          }
        : initial,
    ),
    [step, setStep] = useState(0),
    [expanded, setExpanded] = useState(
      !basic.some(([key]) => key === initial.schedule),
    ),
    [errors, setErrors] = useState<string[]>([]),
    [reviewReturn, setReviewReturn] = useState(false);
  const initialDraft = useRef(JSON.stringify(d));
  const slotCache = useRef<Partial<Record<ScheduleKind, Slot[]>>>({
    [initial.schedule]: initial.slots,
  });
  const title = useRef<HTMLHeadingElement>(null),
    errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  const update = (patch: Partial<SetupDraft>) =>
    setD((prev) => {
      const next = { ...prev, ...patch };
      return {
        ...next,
        inventory: {
          ...next.inventory,
          unit: next.unit,
          enabled: next.inventory.enabled && stockEligible(next),
        },
      };
    });
  const go = (n: number) => {
    setStep(n);
    setErrors([]);
    requestAnimationFrame(() => title.current?.focus());
  };
  const schedule = (kind: ScheduleKind) => {
    slotCache.current[d.schedule] = d.slots;
    const count =
      kind === "twice"
        ? 2
        : kind === "multiple"
          ? Math.max(3, d.slots.length)
          : ["daily", "interval", "prn"].includes(kind)
            ? 1
            : d.slots.length;
    const defaults = ["08:00", "18:00", "12:00"];
    const slots =
      slotCache.current[kind] ??
      Array.from(
        { length: count },
        (_, i) =>
          d.slots[i] ?? {
            id: crypto.randomUUID(),
            time: defaults[i] ?? clock(480 + i * 60),
            quantity: "1",
          },
      );
    update({ schedule: kind, slots, proposalAccepted: false });
  };
  const check = () => {
    const all = validateTreatment(d, state.now, !!original);
    return all.filter((msg) =>
      step === 0
        ? /name|form\/type|unit, or/.test(msg)
        : step === 1
          ? /weekday|interval|on\/off|proposal/.test(msg)
          : step === 2
            ? /start date|time and positive|different times|reference quantity/.test(
                msg,
              )
            : step === 4
              ? /stock/.test(msg)
              : false,
    );
  };
  const next = async () => {
    const e =
      step === 5 ? validateTreatment(d, state.now, !!original) : check();
    if (e.length) {
      setErrors(e);
      return;
    }
    if (step === 5) {
      const message = await onSave(d);
      if (message) setErrors([message]);
      return;
    }
    if (reviewReturn) {
      setReviewReturn(false);
      go(5);
    } else go(step + 1);
  };
  const edit = (n: number) => {
    setReviewReturn(true);
    go(n);
  };
  const repeatTimes = setupGroupTimes(d, state, original);
  const stock = d.inventory;
  const summary = [
    `${d.name || "Unnamed"} · ${d.kind === "medication" ? d.form : d.equipmentType} · ${d.unit}`,
    scheduleLabel(d),
    `${displayISO(startDate(d))}${d.schedule === "prn" ? ` · reference quantity ${d.slots[0].quantity} ${d.unit}; no automatic reminders` : " · " + d.slots.map((s) => `${s.time}: ${s.quantity} ${d.unit}`).join("; ")}`,
    d.schedule === "prn"
      ? "No scheduled repeat cycle"
      : repeatTimes
          .map(
            (tm) =>
              `${clock(tm)}: ${state.repeatPreferences[tm] !== undefined && !d.groupEdits[tm] ? state.repeatPreferences[tm] : (d.groupIntervals[tm] ?? d.repeat)} min`,
          )
          .join(" · "),
    stock.enabled
      ? `Stock ${stock.current} ${stock.unit}; low-stock notice at ${stock.threshold}`
      : "Inventory off",
  ];
  return (
    <Modal
      title={
        original
          ? `Edit registered ${d.kind === "medication" ? "medication" : "equipment"}`
          : `Add ${d.kind === "medication" ? "medication" : "equipment change"}`
      }
      onClose={onCancel}
      dirty={initialDirty || JSON.stringify(d) !== initialDraft.current}
      className="setup-dialog"
    >
      <form
        className="setup-body"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          next();
        }}
      >
        <div className="setup-progress">
          <span>Step {step + 1} of 6</span>
          <span>{original ? "Registered treatment" : "New item"}</span>
        </div>
        <h3 ref={title} tabIndex={-1}>
          {steps[step]}
        </h3>
        {errors.length > 0 && (
          <div
            id="setup-errors"
            ref={errorRef}
            tabIndex={-1}
            className="error"
            role="alert"
          >
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {step === 0 && (
          <div className="setup-fields">
            <div className="setup-field">
              <label htmlFor="treatment-name">Name</label>
              <Input
                id="treatment-name"
                value={d.name}
                maxLength={180}
                autoComplete="off"
                aria-invalid={
                  errors.some((e) => e.includes("name")) || undefined
                }
                aria-describedby={errors.length ? "setup-errors" : undefined}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            {d.kind === "medication" && (
              <ChoiceField
                id="medication-form"
                label="Form"
                value={d.form}
                options={[
                  "Tablet",
                  "Pill",
                  "Capsule",
                  "Sachet",
                  "Liquid",
                  "Drops",
                  "Injection",
                  "Inhaler",
                  "Cream",
                  "Patch",
                ]}
                onChange={(form) => update({ form })}
              />
            )}
            <ChoiceField
              id="dose-unit"
              label={d.kind === "medication" ? "Dose unit" : "Quantity unit"}
              value={d.unit}
              options={
                d.kind === "medication"
                  ? [
                      "tablet",
                      "pill",
                      "capsule",
                      "sachet",
                      "mg",
                      "microgram",
                      "mL",
                      "drop",
                      "puff",
                      "patch",
                      "unit",
                    ]
                  : ["sensor", "catheter", "set", "item"]
              }
              onChange={(unit) =>
                update({
                  unit,
                  inventory: {
                    ...stock,
                    unit: !stock.enabled ? unit : stock.unit,
                  },
                })
              }
            />
            {d.kind === "medication" && (
              <div className="setup-field">
                <label htmlFor="dose-detail">Strength or note (optional)</label>
                <Input
                  id="dose-detail"
                  value={d.detail}
                  maxLength={80}
                  onChange={(e) => update({ detail: e.target.value })}
                />
              </div>
            )}
            <details className="setup-note">
              <summary>Future additions</summary>
              <p>
                Database lookup and barcode scanning are not implemented. Enter
                the details manually.
              </p>
            </details>
          </div>
        )}
        {step === 1 && (
          <div className="setup-fields">
            <div className="schedule-choices">
              {basic.map(([key, label]) => (
                <Button
                  type="button"
                  variant="outline"
                  key={key}
                  aria-pressed={d.schedule === key}
                  onClick={() => schedule(key)}
                >
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                More options
              </Button>
            </div>
            {expanded && (
              <div className="schedule-choices more-schedules">
                {more.map(([key, label]) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={key}
                    aria-pressed={d.schedule === key}
                    onClick={() => schedule(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
            {d.schedule === "prn" && (
              <p className="status-tag">No automatic scheduled reminders</p>
            )}
            {d.schedule === "interval" && (
              <>
                <div className="field-pair">
                  <div className="setup-field">
                    <label htmlFor="interval-every">Repeat every</label>
                    <Input
                      id="interval-every"
                      type="number"
                      min="1"
                      step="1"
                      value={d.intervalEvery || ""}
                      onChange={(e) =>
                        update({
                          intervalEvery: Number(e.target.value),
                          proposalAccepted: false,
                        })
                      }
                    />
                  </div>
                  <div className="setup-field">
                    <label htmlFor="interval-unit">Interval unit</label>
                    <NativeSelect
                      id="interval-unit"
                      value={d.intervalUnit}
                      onChange={(e) =>
                        update({
                          intervalUnit: e.target.value as "hours" | "days",
                          proposalAccepted: false,
                        })
                      }
                    >
                      <option value="days">Days (local time)</option>
                      <option value="hours">Hours (elapsed)</option>
                    </NativeSelect>
                  </div>
                </div>
                {d.intervalUnit === "hours" && (
                  <p className="scope">
                    Every {d.intervalEvery || "?"} elapsed hours from the first
                    date/time. Local reminder times can change with time zone or
                    daylight saving.
                  </p>
                )}
              </>
            )}
            {d.schedule === "weekdays" && (
              <fieldset className="weekday-choice">
                <legend>On these weekdays</legend>
                {[
                  ["Mon", 1],
                  ["Tue", 2],
                  ["Wed", 3],
                  ["Thu", 4],
                  ["Fri", 5],
                  ["Sat", 6],
                  ["Sun", 0],
                ].map(([label, n]) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={d.weekdays.includes(Number(n))}
                      onChange={(e) =>
                        update({
                          weekdays: e.target.checked
                            ? [...d.weekdays, Number(n)]
                            : d.weekdays.filter((x) => x !== n),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            {d.schedule === "cycle" && (
              <>
                <div className="field-pair">
                  <div className="setup-field">
                    <label htmlFor="cycle-on">Days on</label>
                    <Input
                      id="cycle-on"
                      type="number"
                      min="1"
                      step="1"
                      value={d.onDays || ""}
                      onChange={(e) =>
                        update({
                          onDays: Number(e.target.value),
                          proposalAccepted: false,
                        })
                      }
                    />
                  </div>
                  <div className="setup-field">
                    <label htmlFor="cycle-off">Days off</label>
                    <Input
                      id="cycle-off"
                      type="number"
                      min="1"
                      step="1"
                      value={d.offDays || ""}
                      onChange={(e) =>
                        update({
                          offDays: Number(e.target.value),
                          proposalAccepted: false,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="proposal">
                  <p>
                    Schedule proposal: repeat {d.onDays || "?"} days on, then{" "}
                    {d.offDays || "?"} days off, anchored to the start date. Use
                    the same local times on each on-day. Basic proposal for
                    review; not a clinically validated regimen.
                  </p>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={d.proposalAccepted}
                      onChange={(e) =>
                        update({ proposalAccepted: e.target.checked })
                      }
                    />
                    Use this cycle proposal{" "}
                  </label>
                </div>
              </>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="setup-fields">
            {original &&
              state.timeMoves?.some((m) => m.treatmentId === d.id) && (
                <p className="proposal">
                  Base schedule shown. Changing it replaces repeating time
                  adjustments; one-off dates/times remain fixed. Name, unit and
                  quantity edits keep the time adjustments.
                </p>
              )}
            <div className="setup-field">
              <label htmlFor="start-date">
                {original ? "Start / anchor date" : "Start date"}
              </label>
              <DateInput
                id="start-date"
                value={Number.isFinite(d.startDay) ? startDate(d) : ""}
                draftText={d.startDateText}
                onChange={(iso, text) =>
                  update({ startDay: fromISO(iso), startDateText: text })
                }
              />
            </div>
            {d.schedule === "prn" ? (
              <>
                <p className="status-tag">As needed · no automatic reminders</p>
                <div className="setup-field">
                  <label htmlFor="reference-quantity">
                    Reference quantity ({d.unit})
                  </label>
                  <Input
                    id="reference-quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={d.slots[0].quantity}
                    onChange={(e) =>
                      update({
                        slots: [{ ...d.slots[0], quantity: e.target.value }],
                      })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                {d.slots.map((slot, index) => (
                  <div className="administration" key={slot.id}>
                    <div className="field-pair">
                      <div className="setup-field">
                        <label htmlFor={`time-${slot.id}`}>
                          {d.schedule === "interval" &&
                          d.intervalUnit === "hours"
                            ? "First time"
                            : `Time ${index + 1}`}
                        </label>
                        <Input
                          id={`time-${slot.id}`}
                          type="time"
                          value={slot.time}
                          onInput={(e) =>
                            update({
                              slots: d.slots.map((s) =>
                                s.id === slot.id
                                  ? { ...s, time: e.currentTarget.value }
                                  : s,
                              ),
                            })
                          }
                          onChange={(e) =>
                            update({
                              slots: d.slots.map((s) =>
                                s.id === slot.id
                                  ? { ...s, time: e.target.value }
                                  : s,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="setup-field">
                        <label htmlFor={`quantity-${slot.id}`}>
                          {d.kind === "medication" ? "Dose" : "Change quantity"}{" "}
                          {index + 1} ({d.unit || "unit"})
                        </label>
                        <Input
                          id={`quantity-${slot.id}`}
                          type="number"
                          min="0"
                          step="any"
                          readOnly={
                            d.kind === "equipment" &&
                            d.equipmentType === "sensor"
                          }
                          value={slot.quantity}
                          onChange={(e) =>
                            update({
                              slots: d.slots.map((s) =>
                                s.id === slot.id
                                  ? { ...s, quantity: e.target.value }
                                  : s,
                              ),
                            })
                          }
                        />
                      </div>
                    </div>
                    {["multiple", "weekdays", "cycle"].includes(d.schedule) &&
                      d.slots.length > (d.schedule === "multiple" ? 2 : 1) && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            update({
                              slots: d.slots.filter((s) => s.id !== slot.id),
                            })
                          }
                        >
                          Remove time {index + 1}
                        </Button>
                      )}
                  </div>
                ))}
                {["multiple", "weekdays", "cycle"].includes(d.schedule) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const candidates = [
                        ...Array.from(
                          { length: 24 },
                          (_, i) => (480 + i * 60) % 1440,
                        ),
                        ...Array.from({ length: 1440 }, (_, i) => i),
                      ];
                      const n = candidates.find(
                        (n) => !d.slots.some((s) => s.time === clock(n)),
                      );
                      if (n === undefined) {
                        setErrors(["Every clock minute is already used."]);
                        return;
                      }
                      update({
                        slots: [
                          ...d.slots,
                          {
                            id: crypto.randomUUID(),
                            time: clock(n),
                            quantity: "1",
                          },
                        ],
                      });
                    }}
                  >
                    Add another time
                  </Button>
                )}
              </>
            )}
            {!original && d.startDay === Math.floor(state.now / 1440) && (
              <p className="scope">
                Only times at or after the current time are added; earlier doses
                are not backfilled.
              </p>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="setup-fields">
            {original &&
              state.timeMoves?.some((m) => m.treatmentId === d.id) && (
                <p className="scope">
                  Includes saved time groups used by this treatment’s scoped
                  reminders.
                </p>
              )}
            {!repeatTimes.length ? (
              <p>No scheduled time groups for an as-needed item.</p>
            ) : (
              repeatTimes.map((tm) => {
                const existing = state.repeatPreferences[tm],
                  canEdit =
                    !!original &&
                    [
                      ...treatmentTimes(original),
                      ...actualGroupTimes(state, original.id),
                    ].includes(tm);
                const editingGroup = !!d.groupEdits[tm];
                return (
                  <section className="repeat-group" key={tm}>
                    <div>
                      <strong>{clock(tm)}</strong>
                      <span>
                        {existing !== undefined
                          ? "Existing time group"
                          : "New time group"}
                      </span>
                    </div>
                    {existing !== undefined && !editingGroup ? (
                      <p className="saved-interval">
                        Reuse every {existing} minutes until Taken/Done or
                        Skipped.
                        {state.groups.some(
                          (g) =>
                            g.due === d.startDay * 1440 + tm &&
                            g.interval !== existing,
                        ) && (
                          <span>
                            {" "}
                            The existing occurrence keeps its{" "}
                            {
                              state.groups.find(
                                (g) => g.due === d.startDay * 1440 + tm,
                              )!.interval
                            }
                            -minute cadence; later groups use {existing}{" "}
                            minutes.
                          </span>
                        )}
                      </p>
                    ) : (
                      <>
                        <label htmlFor={`repeat-${tm}`}>
                          Repeat interval for {clock(tm)}
                        </label>
                        <NativeSelect
                          id={`repeat-${tm}`}
                          value={d.groupIntervals[tm] ?? existing ?? d.repeat}
                          onChange={(e) =>
                            update({
                              groupIntervals: {
                                ...d.groupIntervals,
                                [tm]: Number(e.target.value),
                              },
                            })
                          }
                        >
                          {[5, 10, 15, 20, 30].map((n) => (
                            <option key={n} value={n}>
                              {n} minutes
                            </option>
                          ))}
                        </NativeSelect>
                      </>
                    )}
                    {existing !== undefined && canEdit && (
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={editingGroup}
                          onChange={(e) =>
                            update({
                              groupEdits: {
                                ...d.groupEdits,
                                [tm]: e.target.checked,
                              },
                            })
                          }
                        />
                        Edit the shared {clock(tm)} interval for all items
                      </label>
                    )}
                    {editingGroup && (
                      <p className="scope">
                        Explicit shared-group change: future reminders use the
                        new interval; active cycles keep their cadence.
                      </p>
                    )}
                  </section>
                );
              })
            )}
          </div>
        )}
        {step === 4 && (
          <div className="setup-fields">
            <label className="check-row">
              <input
                type="checkbox"
                disabled={!stockEligible(d)}
                checked={stock.enabled}
                onChange={(e) =>
                  update({ inventory: { ...stock, enabled: e.target.checked } })
                }
              />
              Enable stock tracking
            </label>
            {!stockEligible(d) && (
              <p>
                Stock tracking is available for counted units only. Liquids and
                drops are not tracked.
              </p>
            )}
            {stock.enabled && (
              <>
                <div className="field-pair">
                  <div className="setup-field">
                    <label htmlFor="stock-current">Current stock</label>
                    <Input
                      id="stock-current"
                      type="number"
                      min="0"
                      step="any"
                      value={stock.current}
                      onChange={(e) =>
                        update({
                          inventory: { ...stock, current: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="setup-field">
                    <label htmlFor="stock-threshold">Low-stock notice at</label>
                    <Input
                      id="stock-threshold"
                      type="number"
                      min="0"
                      step="any"
                      value={stock.threshold}
                      onChange={(e) =>
                        update({
                          inventory: { ...stock, threshold: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
                <p>Stock uses {d.unit}.</p>
                <p className="scope">
                  Taken/Done deducts the recorded quantity; Undo restores it.
                  Keep stock and dose/quantity units the same.
                </p>
              </>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="setup-review">
            <p className="local-save-label">
              Saved to your private Wuff account
            </p>
            {original && (
              <p className="scope">
                Recorded and already-due reminders keep their original details.
                Future unrecorded reminders update; one-off dates and times stay
                fixed.
              </p>
            )}
            {summary.map((text, index) => (
              <section className="review-section" key={index}>
                <div>
                  <h4>{steps[index]}</h4>
                  <p>{text}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => edit(index)}
                >
                  Edit {steps[index]}
                </Button>
              </section>
            ))}
            {original && Object.values(d.groupEdits).some(Boolean) && (
              <p className="proposal">
                Shared interval edits affect all items in those future time
                groups, not just this treatment.
              </p>
            )}
            <details className="setup-note">
              <summary>Open questions for review</summary>
              <p>
                Complex cycle exceptions, travel across the date line and unit
                conversions remain open for review.
              </p>
            </details>
          </div>
        )}
        <footer className="setup-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (step === 0) {
                onFirstBack(
                  d,
                  initialDirty || JSON.stringify(d) !== initialDraft.current,
                );
                return;
              }
              setReviewReturn(false);
              go(step - 1);
            }}
          >
            Back
          </Button>
          <Button type="submit" variant="primary">
            {step === 5
              ? "Save item"
              : reviewReturn
                ? "Back to review"
                : "Next"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
