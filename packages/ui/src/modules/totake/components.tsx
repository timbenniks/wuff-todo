"use client";
import type { StockMovement } from "@wuff/contracts/totake/stock";
import { TriangleAlert } from "lucide-react";
import { Button } from "@wuff/ui/button";
import { NativeSelect } from "@wuff/ui/native-select";
import { date, time, reminderTiming, type State, type Item, type Occurrence } from "@wuff/contracts/totake/model";
export function OverdueLabel({
  state,
  group,
}: {
  state: State;
  group: Occurrence;
}) {
  return reminderTiming(state, group) === "overdue" ? (
    <p className="reminder-overdue" role="status">
      <TriangleAlert size={16} aria-hidden="true" />
      Overdue · unrecorded
    </p>
  ) : null;
}
export function ItemName({ item }: { item: Item }) {
  return (
    <span className="item-name">
      <strong>{item.name}</strong>
      <span>{item.dose}</span>
      {item.movedFrom !== undefined && (
        <small>
          Original reminder {date(item.movedFrom)}, {time(item.movedFrom)}
        </small>
      )}
    </span>
  );
}
export function SnoozeControls({
  id,
  count,
  minutes,
  onMinutes,
  onSnooze,
  showExplanation = false,
  disabled = false,
}: {
  disabled?: boolean;
  showExplanation?: boolean;
  id: string;
  count: number;
  minutes: number;
  onMinutes: (minutes: number) => void;
  onSnooze: () => void;
}) {
  return (
    <div className="snooze-controls">
      <label className="field-label" htmlFor={id}>
        Snooze duration · selected items only
      </label>
      <NativeSelect
        id={id}
        value={minutes}
        onChange={(e) => onMinutes(Number(e.target.value))}
      >
        {[15, 30, 45, 60].map((n) => (
          <option key={n} value={n}>
            {n === 60 ? "1 hour" : `${n} minutes`}
          </option>
        ))}
      </NativeSelect>
      <Button disabled={!count || disabled} onClick={onSnooze}>
        Snooze selected ({count})
      </Button>
      {disabled && (
        <p className="scope">Snooze is available when this reminder is due.</p>
      )}
      {showExplanation && (
        <p className="scope">
          One-time pause for {count} selected item{count === 1 ? "" : "s"}.
          Unselected items keep their reminders. After expiry, the saved repeat
          interval resumes.
        </p>
      )}
    </div>
  );
}
export function RecordedGroups({
  groups,
  onUndo,
  stockMovements = [],
}: {
  stockMovements?: StockMovement[];
  groups: Occurrence[];
  onUndo: (g: Occurrence, recordId: string) => void;
}) {
  return (
    <div className="recorded-groups">
      {groups.map((g) => (
        <section
          className="card recorded-group"
          key={g.id}
          aria-label={`Recorded ${date(g.due)} ${time(g.due)} ${g.title}`}
        >
          <header className="group-top">
            <div>
              <h3>
                {time(g.due)} · {g.title}
              </h3>
              <p className="muted">
                Scheduled {date(g.due)}, {time(g.due)}
              </p>
            </div>
          </header>
          <ul className="record-list">
            {g.records.map((r) => {
              const item = g.items.find((i) => i.id === r.itemId)!;
              const movement = stockMovements.find(
                (m) => m.kind === "taken" && m.recordId === r.id,
              );
              return (
                <li key={`${g.id}-${r.itemId}`}>
                  <div>
                    <ItemName item={item} />
                    <small>
                      Recorded {date(r.at)}, {time(r.at)}
                      {r.zone ? ` · ${r.zone}` : ""}
                    </small>
                    {movement && (
                      <small>
                        Stock: {movement.delta} {movement.unit}
                      </small>
                    )}
                  </div>
                  <span
                    className="status-tag"
                    data-tone={r.outcome === "taken" ? "success" : "review"}
                  >
                    {r.outcome === "skipped"
                      ? "Skipped"
                      : item.kind === "equipment"
                        ? "Done"
                        : "Taken"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Undo ${item.name} scheduled ${date(g.due)} ${time(g.due)}`}
                    onClick={() => onUndo(g, r.id)}
                  >
                    Undo
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
