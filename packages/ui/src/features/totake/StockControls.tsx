"use client";
import { TriangleAlert } from "lucide-react";
import { warningDetails } from "@wuff/contracts/totake/stockWarnings";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@wuff/ui/button";
import { Input } from "@wuff/ui/input";
import { Modal } from "./Modal";
import { date, time, type State } from "@wuff/contracts/totake/model";
import type { Treatment } from "@wuff/contracts/totake/treatments";
import { amount, forecast, stockState } from "@wuff/contracts/totake/stock";
export function StockSummary({
  state,
  treatment: t,
  onAdjust,
}: {
  state: State;
  treatment: Treatment;
  onAdjust: (kind: "add" | "correct") => void;
}) {
  const estimate = useMemo(() => forecast(state, t), [state, t]);
  const stock = stockState(state),
    movements = stock.movements.filter((m) => m.treatmentId === t.id);
  const warning = warningDetails(t, estimate, state.now);
  return (
    <section
      id={`stock-details-${t.id}`}
      tabIndex={-1}
      className="stock-summary"
      aria-label={`Stock for ${t.name}`}
    >
      <strong>
        Stock: {t.inventory.current} {t.inventory.unit}
      </strong>
      <small>
        Low-stock threshold: {t.inventory.threshold} {t.inventory.unit}
      </small>
      {Number(t.inventory.current) < 0 && (
        <p className="stock-discrepancy" role="status">
          Balance discrepancy: recorded use exceeds stock. Count supplies and
          use Correct stock.
        </p>
      )}
      <p className="stock-estimate" hidden={!!warning}>
        {estimate.label}
      </p>
      {estimate.reason && <small>{estimate.reason}</small>}
      {estimate.overdue > 0 && (
        <small>
          Overdue unrecorded: {estimate.overdue} {t.inventory.unit} · excluded
          from forecast
        </small>
      )}
      {warning && (
        <div
          className="stock-warning-panel warning-surface"
          data-tone={warning.tone}
          role="status"
        >
          <TriangleAlert size={20} aria-hidden="true" />
          <div>
            <strong>
              {warning.tone === "danger" ? "Insufficient stock" : "Low stock"}
              {warning.days !== undefined
                ? ` · ${warning.days === 0 ? "runs out today" : `~${warning.days} day${warning.days === 1 ? "" : "s"} remaining`}`
                : ""}
            </strong>
            <p>{estimate.label}</p>
            <Button size="sm" variant="outline" onClick={() => onAdjust("add")}>
              Add stock
            </Button>
          </div>
        </div>
      )}
      <div className="stock-actions">
        {!warning && (
          <Button size="sm" variant="outline" onClick={() => onAdjust("add")}>
            Add stock
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onAdjust("correct")}>
          Correct stock
        </Button>
      </div>
      <details className="stock-history">
        <summary>Stock history ({movements.length})</summary>
        {!movements.length ? (
          <p>No stock movements yet. Existing balance is the starting point.</p>
        ) : (
          <ol>
            {[...movements].reverse().map((m) => (
              <li key={m.id}>
                <strong>
                  {
                    {
                      opening: "Tracking balance",
                      taken: "Taken/Done",
                      undo: "Undo",
                      add: "Stock received",
                      correct: "Count correction",
                    }[m.kind]
                  }
                </strong>
                <span>
                  {m.delta > 0 ? "+" : ""}
                  {m.deltaExact ?? m.delta} {m.unit} →{" "}
                  {m.balanceExact ?? m.balance} {m.unit}
                </span>
                <small>
                  {date(m.at)}, {time(m.at)}
                </small>
                {m.recordId && (
                  <small>
                    Record {m.recordId}
                    {m.scheduledDue !== undefined
                      ? ` · scheduled ${date(m.scheduledDue)}, ${time(m.scheduledDue)}`
                      : " · as-needed intake"}
                  </small>
                )}
                {m.reverses && <small>Restores {m.reverses}</small>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}
export function StockAdjustment({
  treatment: t,
  kind,
  onCancel,
  onSave,
}: {
  treatment: Treatment;
  kind: "add" | "correct";
  onCancel: () => void;
  onSave: (value: string, id: string, fail: boolean) => Promise<string | null>;
}) {
  const [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [fail, setFail] = useState(false),
    [id] = useState(() => crypto.randomUUID());
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const title = kind === "add" ? "Add stock" : "Correct stock";
  return (
    <Modal
      title={title}
      onClose={onCancel}
      dirty={value !== ""}
      className="setup-dialog"
    >
      <form
        className="setup-body"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            amount(value, kind === "add");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Enter a valid quantity.",
            );
            return;
          }
          const message = await onSave(value, id, fail);
          setFail(false);
          if (message) setError(message);
        }}
      >
        <h3>{t.name}</h3>
        <p>
          Current balance: {t.inventory.current} {t.inventory.unit}
        </p>
        {error && (
          <p ref={errorRef} tabIndex={-1} className="error" role="alert">
            {error}
          </p>
        )}
        <div className="setup-field">
          <label htmlFor="stock-adjustment">
            {kind === "add"
              ? "Quantity received"
              : "Actual total after counting"}{" "}
            ({t.inventory.unit})
          </label>
          <Input
            id="stock-adjustment"
            type="number"
            min={kind === "add" ? "0.000000000001" : "0"}
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!error || undefined}
          />
        </div>
        <p className="scope">
          {kind === "add"
            ? "Adds this quantity to the existing balance."
            : "Replaces the balance with the actual counted total."}{" "}
          Saves to your private Wuff account.
        </p>
        <footer className="setup-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
