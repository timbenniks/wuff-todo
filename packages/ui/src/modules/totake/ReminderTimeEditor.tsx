"use client";
import { DateInput } from "./DateInput";
import { useEffect, useRef, useState } from "react";
import { Button } from "@wuff/ui/button";
import { Input } from "@wuff/ui/input";
import { Modal } from "./Modal";
import {
  date,
  time,
  type Item,
  type Occurrence,
  type State,
} from "@wuff/contracts/totake/model";
import { clock, fromISO, minute } from "@wuff/contracts/totake/treatments";
import { isoDay } from "@wuff/contracts/totake/calendar";
export function ReminderTimeEditor({
  group,
  item,
  state,
  onCancel,
  onSave,
}: {
  group: Occurrence;
  item: Item;
  state: State;
  onCancel: () => void;
  onSave: (
    due: number,
    scope: "one" | "future",
    proposal: boolean,
  ) => Promise<string | null>;
}) {
  const [day, setDay] = useState(isoDay(Math.floor(group.due / 1440))),
    [tm, setTime] = useState(time(group.due)),
    [scope, setScope] = useState<"" | "one" | "future">(""),
    [error, setError] = useState(""),
    [proposal, setProposal] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const treatment = state.treatments?.find((t) => t.id === item.treatmentId),
    hourly =
      treatment?.schedule === "interval" && treatment.intervalUnit === "hours",
    shift = fromISO(day) - Math.floor(group.due / 1440),
    needsProposal = scope === "future" && !hourly && shift !== 0;
  const due = fromISO(day) * 1440 + minute(tm),
    newInterval = state.repeatPreferences[minute(tm)] ?? group.interval;
  return (
    <Modal
      title={hourly ? "Adjust schedule" : "Change reminder date/time"}
      onClose={onCancel}
      dirty={
        day !== isoDay(Math.floor(group.due / 1440)) ||
        tm !== time(group.due) ||
        scope !== "" ||
        proposal
      }
      className="setup-dialog"
    >
      <form
        className="setup-body"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!scope) {
            setError(
              "Choose This reminder only or This and all future reminders.",
            );
            return;
          }
          if (!Number.isFinite(due) || !/^\d{2}:\d{2}$/.test(tm)) {
            setError("Enter a valid date in DD-MM-YYYY and a time in HH:mm.");
            return;
          }
          const message = await onSave(due, scope, proposal);
          if (message) setError(message);
        }}
      >
        <h3>{item.name}</h3>
        <p className="scope">
          Currently {date(group.due)}, {time(group.due)} · {item.dose}
        </p>
        {error && (
          <p ref={errorRef} tabIndex={-1} className="error" role="alert">
            {error}
          </p>
        )}
        <div className="field-pair">
          <div className="setup-field">
            <label htmlFor="move-date">Reminder date</label>
            <DateInput
              id="move-date"
              value={day}
              onChange={(iso) => {
                setDay(iso);
                setProposal(false);
              }}
            />
          </div>
          <div className="setup-field">
            <label htmlFor="move-time">Reminder time</label>
            <Input
              id="move-time"
              type="time"
              value={tm}
              onInput={(e) => {
                setTime(e.currentTarget.value);
                setProposal(false);
              }}
              onChange={(e) => {
                setTime(e.target.value);
                setProposal(false);
              }}
            />
          </div>
        </div>
        <fieldset className="scope-choice">
          <legend>Apply the date/time change to</legend>
          <label>
            <input
              type="radio"
              name="move-scope"
              checked={scope === "one"}
              onChange={() => {
                setScope("one");
                setProposal(false);
              }}
            />
            This reminder only
          </label>
          <label>
            <input
              type="radio"
              name="move-scope"
              checked={scope === "future"}
              onChange={() => {
                setScope("future");
                setProposal(false);
              }}
            />
            This and all future reminders
          </label>
        </fieldset>
        <p className="scope">
          Date/time only for this administration slot. Treatment name, unit,
          other administration times and recorded history are unchanged.
        </p>
        {hourly && (
          <p className="scope">
            {scope === "one"
              ? "Move just this reminder; keep the elapsed-hour anchor."
              : scope === "future"
                ? "Use the new date/time as the reference for this and later elapsed-hour reminders."
                : "Choose whether to move only the next reminder or also replace the future interval anchor."}
          </p>
        )}
        {scope === "future" &&
          !hourly &&
          (needsProposal ? (
            <div className="proposal">
              <p>
                {hourly
                  ? "Schedule proposal: shift this and later hourly reminders by the same amount, preserving their hour spacing."
                  : `Schedule proposal: shift this administration’s future dates by ${shift} day${Math.abs(shift) === 1 ? "" : "s"} and use the new clock time, preserving its spacing.`}{" "}
                Other administration slots and recorded entries stay unchanged.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={proposal}
                  onChange={(e) => setProposal(e.target.checked)}
                />
                Use this future-shift proposal{" "}
              </label>
            </div>
          ) : (
            <p className="scope">
              Future clock times change for this administration slot; its
              scheduled day pattern stays the same.
            </p>
          ))}
        <p className="scope">
          {state.repeatPreferences[minute(tm)] !== undefined
            ? `Destination ${clock(minute(tm))}: reuse its saved ${newInterval}-minute group interval.`
            : `New ${clock(minute(tm))} group: retain the source group's ${newInterval}-minute interval.`}
        </p>
        <footer className="setup-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save date/time
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
