"use client";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@wuff/ui/button";
import { Input } from "@wuff/ui/input";
import { Textarea } from "@wuff/ui/textarea";
import { NativeSelect } from "@wuff/ui/native-select";
import { Modal } from "./Modal";
import { DateInput } from "./DateInput";
import { ChoiceField } from "./SetupWizard";
import { date, time, type State } from "@wuff/contracts/totake/model";
import { resolveWall } from "@wuff/contracts/totake/timeZone";
import { amount } from "@wuff/contracts/totake/stock";
import {
  intakeWall,
  intakeInstant,
  validateIntakeDetails,
  type IntakeDraft,
  type Intake,
} from "@wuff/contracts/totake/oneTime";

export function OneTimeFlow({
  initial,
  state,
  onBack,
  onCancel,
  onSave,
  initialDirty = false,
}: {
  initial: IntakeDraft;
  state: State;
  initialDirty?: boolean;
  onBack: (d: IntakeDraft, dirty: boolean) => void;
  onCancel: () => void;
  onSave: (d: IntakeDraft, fail: boolean) => Promise<string | null>;
}) {
  const [d, setD] = useState(initial),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [fail, setFail] = useState(false),
    [newSelected, setNewSelected] = useState(
      !initial.medicationId && !!initial.medication.name,
    );
  const baseline = useRef(JSON.stringify(initial)),
    heading = useRef<HTMLHeadingElement>(null),
    errorRef = useRef<HTMLParagraphElement>(null);
  const dirty =
    initialDirty || JSON.stringify(d) !== baseline.current || newSelected;
  const medication = d.medicationId
    ? state.treatments?.find((t) => t.id === d.medicationId)
    : d.medication;
  const update = (patch: Partial<IntakeDraft>) =>
    setD((prev) => ({ ...prev, ...patch }));
  const detail = (patch: Partial<IntakeDraft["medication"]>) =>
    setD((prev) => ({ ...prev, medication: { ...prev.medication, ...patch } }));
  const go = (n: number) => {
    setError("");
    setStep(n);
    requestAnimationFrame(() => heading.current?.focus());
  };
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  let fold = false;
  try {
    fold =
      !!state.clock &&
      Number.isInteger(intakeWall(d)) &&
      resolveWall(intakeWall(d), state.clock.zone).fold;
  } catch {
    /* Validation reports malformed input on submit. */
  }
  async function next() {
    try {
      if (step === 0) {
        if (d.medicationId) {
          go(2);
          return;
        }
        if (!newSelected)
          throw Error("Choose an as-needed medication or Add new medication.");
        go(1);
        return;
      }
      if (step === 1) {
        validateIntakeDetails(d.medication);
        if (!d.strength) update({ strength: d.medication.detail });
        go(2);
        return;
      }
      amount(d.quantity, true);
      intakeInstant(state, d);
      const message = await onSave(d, fail);
      setFail(false);
      if (message) setError(message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Check the entered details and try again.",
      );
    }
  }
  return (
    <Modal
      title="One-time entry"
      className="setup-dialog one-time-dialog"
      dirty={dirty}
      onClose={onCancel}
    >
      <form
        className="setup-body"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          next();
        }}
      >
        <h3 ref={heading} tabIndex={-1}>
          {step === 0
            ? "Choose a medication"
            : step === 1
              ? "Medication details"
              : "Record an intake"}
        </h3>
        {error && (
          <p ref={errorRef} className="error" role="alert" tabIndex={-1}>
            {error}
          </p>
        )}
        {step === 0 && (
          <div className="setup-fields">
            <div
              className="one-time-choices"
              role="group"
              aria-label="Registered as-needed medications"
            >
              {state.treatments
                ?.filter((t) => t.kind === "medication" && t.schedule === "prn")
                .map((t) => (
                  <Button
                    className="one-time-option"
                    key={t.id}
                    type="button"
                    variant="outline"
                    aria-pressed={d.medicationId === t.id}
                    onClick={() => {
                      if (t.id !== d.medicationId)
                        update({
                          medicationId: t.id,
                          quantity: t.slots[0]?.quantity ?? "1",
                          strength: t.detail,
                        });
                      setNewSelected(false);
                    }}
                  >
                    <span className="choice-indicator" aria-hidden="true">
                      {d.medicationId === t.id && <Check size={20} />}
                    </span>
                    <span>
                      <strong>{t.name}</strong>
                      <small>
                        {t.form} · {t.slots[0]?.quantity ?? "1"} {t.unit}
                        {t.detail ? " · " + t.detail : ""}
                      </small>
                    </span>
                  </Button>
                ))}
            </div>
            {!state.treatments?.some(
              (t) => t.kind === "medication" && t.schedule === "prn",
            ) && (
              <p className="muted">No as-needed medications registered yet.</p>
            )}
            <Button
              className="one-time-option"
              type="button"
              variant="outline"
              aria-pressed={newSelected}
              onClick={() => {
                if (d.medicationId)
                  update({
                    medicationId: "",
                    quantity: d.medication.slots[0].quantity,
                    strength: d.medication.detail,
                  });
                setNewSelected(true);
              }}
            >
              <span className="choice-indicator" aria-hidden="true">
                {newSelected && <Check size={20} />}
              </span>
              <span>Add new medication</span>
            </Button>
          </div>
        )}
        {step === 1 && (
          <div className="setup-fields">
            <div className="setup-field">
              <label htmlFor="intake-name">Name</label>
              <Input
                id="intake-name"
                value={d.medication.name}
                maxLength={180}
                onChange={(e) => detail({ name: e.target.value })}
              />
            </div>
            <ChoiceField
              id="intake-form"
              label="Form"
              value={d.medication.form}
              options={[
                "Tablet",
                "Capsule",
                "Liquid",
                "Drops",
                "Injection",
                "Inhaler",
                "Cream",
                "Patch",
              ]}
              onChange={(form) => detail({ form })}
            />
            <ChoiceField
              id="intake-unit"
              label="Dose unit"
              value={d.medication.unit}
              options={[
                "tablet",
                "capsule",
                "mg",
                "microgram",
                "mL",
                "drop",
                "puff",
                "patch",
                "unit",
              ]}
              onChange={(unit) =>
                detail({ unit, inventory: { ...d.medication.inventory, unit } })
              }
            />
            <div className="setup-field">
              <label htmlFor="intake-default-strength">
                Strength or note (optional)
              </label>
              <Input
                id="intake-default-strength"
                value={d.medication.detail}
                maxLength={80}
                onChange={(e) => detail({ detail: e.target.value })}
              />
            </div>
            <p className="scope">
              Saved as an as-needed medication when you record this intake.
            </p>
          </div>
        )}
        {step === 2 && (
          <div className="setup-fields">
            <div className="one-time-medication">
              <strong>{medication?.name}</strong>
              <span>{medication?.form} · As needed</span>
            </div>
            <div className="setup-field">
              <label htmlFor="intake-quantity">
                Quantity taken ({medication?.unit})
              </label>
              <Input
                id="intake-quantity"
                type="number"
                min="0"
                step="any"
                value={d.quantity}
                onChange={(e) => update({ quantity: e.target.value })}
              />
            </div>
            <div className="setup-field">
              <label htmlFor="intake-strength">
                Strength for this intake (optional)
              </label>
              <Input
                id="intake-strength"
                maxLength={80}
                value={d.strength}
                onChange={(e) => update({ strength: e.target.value })}
              />
            </div>
            <div className="field-pair">
              <div className="setup-field">
                <label htmlFor="intake-date">Intake date</label>
                <DateInput
                  id="intake-date"
                  value={d.day}
                  draftText={d.dateText}
                  onChange={(day, dateText) => update({ day, dateText })}
                />
              </div>
              <div className="setup-field">
                <label htmlFor="intake-time">Intake time</label>
                <Input
                  id="intake-time"
                  type="time"
                  value={d.time}
                  onInput={(e) => update({ time: e.currentTarget.value })}
                  onChange={(e) => update({ time: e.target.value })}
                />
              </div>
            </div>
            <small className="muted">
              {state.clock?.zone ?? "Account timezone"}
            </small>
            {fold && (
              <div className="setup-field">
                <label htmlFor="intake-fold">
                  This clock time occurs twice
                </label>
                <NativeSelect
                  id="intake-fold"
                  value={d.fold}
                  onChange={(e) =>
                    update({ fold: e.target.value as "first" | "second" })
                  }
                >
                  <option value="first">
                    First occurrence (before clocks go back)
                  </option>
                  <option value="second">
                    Second occurrence (after clocks go back)
                  </option>
                </NativeSelect>
              </div>
            )}
            <div className="setup-field">
              <label htmlFor="intake-note">Note (optional)</label>
              <Textarea
                id="intake-note"
                value={d.note}
                maxLength={500}
                rows={2}
                onChange={(e) => update({ note: e.target.value })}
              />
            </div>
            <p className="local-save-label">
              Saved to your private Wuff account
            </p>
          </div>
        )}
        <footer className="setup-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (step === 0) onBack(d, dirty);
              else go(step === 1 || d.medicationId ? 0 : 1);
            }}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={step === 0 && !d.medicationId && !newSelected}
          >
            {step === 2 ? "Record as taken" : "Next"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export function IntakeHistory({
  intakes,
  onUndo,
  state,
}: {
  intakes: Intake[];
  onUndo: (id: string) => void;
  state: State;
}) {
  return (
    <div className="recorded-groups one-time-history">
      {[...intakes]
        .sort((a, b) => a.at - b.at)
        .map((r) => (
          <section
            className="card recorded-group"
            key={r.id}
            aria-label={`As-needed intake ${r.item.name} ${date(r.at)} ${time(r.at)}`}
          >
            <header className="group-top">
              <div>
                <h3>{time(r.at)} · As-needed intake</h3>
                <p className="muted">
                  Taken {date(r.at)}, {time(r.at)}
                  {r.zone ? ` · ${r.zone}` : ""}
                </p>
              </div>
            </header>
            <ul className="record-list">
              <li>
                <div>
                  <span className="item-name">
                    <strong>{r.item.name}</strong>
                    <span>{r.item.dose}</span>
                  </span>
                  {r.note && <small className="intake-note">{r.note}</small>}
                  <small>
                    Recorded {date(r.createdAt)}, {time(r.createdAt)}
                  </small>
                  {state.stock?.movements
                    .filter((m) => m.kind === "taken" && m.recordId === r.id)
                    .map((m) => (
                      <small key={m.id}>
                        Stock: {m.delta} {m.unit} · {m.id}
                      </small>
                    ))}
                </div>
                <span className="status-tag" data-tone="success">
                  Taken
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Undo as-needed intake ${r.item.name} ${date(r.at)} ${time(r.at)}`}
                  onClick={() => onUndo(r.id)}
                >
                  Undo
                </Button>
              </li>
            </ul>
          </section>
        ))}
    </div>
  );
}
export function IntakeAudit({ state, day }: { state: State; day: number }) {
  const intakes = (state.intakes ?? []).filter(
    (r) => Math.floor(r.at / 1440) === day,
  );
  return (
    <>
      {state.audit
        .filter((a) => intakes.some((r) => r.id === a.recordId))
        .map((a) => {
          const r = intakes.find((r) => r.id === a.recordId)!;
          return (
            <li key={a.id}>
              <strong>
                {a.action === "undo" ? "Reversed" : "Recorded"} Taken ·{" "}
                {r.item.name} · As needed
              </strong>
              <span>
                Intake {date(r.at)}, {time(r.at)} ·{" "}
                {a.action === "undo" ? "Reversed" : "Recorded"} at {date(a.at)},{" "}
                {time(a.at)}
              </span>
              <small>
                {a.action === "undo" ? "Reverses" : "Original record"} {r.id}
              </small>
            </li>
          );
        })}
    </>
  );
}
