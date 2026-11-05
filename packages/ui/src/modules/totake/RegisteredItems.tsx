"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  totakeEngine as e,
  type Treatment,
  type TotakeAction,
  type TotakeState,
} from "@wuff/contracts";
import { Button } from "../../button";
import { NativeSelect } from "../../native-select";
import { Modal, TotakeSaveContext } from "./Modal";
import { StockSummary } from "./StockControls";

type Intent = "pause" | "resume" | "archive" | "restore" | "delete";
const labels: Record<Intent, string> = {
  pause: "Pause",
  resume: "Resume",
  archive: "Archive",
  restore: "Restore",
  delete: "Delete",
};
export function RegisteredItems({
  state,
  stockFilter,
  clearStockFilter,
  onEdit,
  onAdjust,
  prepare,
  close,
  save,
}: {
  state: TotakeState;
  stockFilter: string[] | null;
  clearStockFilter: () => void;
  onEdit: (treatment: Treatment) => void;
  onAdjust: (id: string, kind: "add" | "correct") => void;
  prepare: () => void;
  close: () => void;
  save: (action: TotakeAction) => Promise<string | null>;
}) {
  const [view, setView] = useState("current");
  const [confirmation, setConfirmation] = useState<{
    treatment: Treatment;
    intent: Intent;
  } | null>(null);
  const [error, setError] = useState("");
  const portal = useRef<HTMLElement | null>(null);
  const operation = useContext(TotakeSaveContext);
  const items = (state.treatments ?? []).filter(
    (t) =>
      t.status !== "deleted" &&
      (stockFilter
        ? stockFilter.includes(t.id)
        : view === "archived"
          ? t.status === "archived"
          : t.status !== "archived"),
  );
  function dismiss() {
    setConfirmation(null);
    setError("");
    close();
  }
  // An acknowledged exact retry can complete outside this dialog's save handler.
  useEffect(() => {
    if (!confirmation) return;
    const current = state.treatments?.find(
      (t) => t.id === confirmation.treatment.id,
    );
    const target =
      confirmation.intent === "delete"
        ? "deleted"
        : confirmation.intent === "pause"
          ? "paused"
          : confirmation.intent === "archive"
            ? "archived"
            : "active";
    if (current?.status === target) dismiss();
  }, [state]);
  const request = (treatment: Treatment, intent: Intent) => {
    prepare();
    setError("");
    setConfirmation({ treatment, intent });
  };
  return (
    <section
      className="card registered"
      ref={(el) => {
        portal.current = el?.closest<HTMLElement>(".totake") ?? null;
      }}
    >
      <h2>{stockFilter ? "Low stock" : "Registered items"}</h2>
      {stockFilter ? (
        <Button onClick={clearStockFilter}>Show all items</Button>
      ) : (
        <label className="registered-filter">
          Show
          <NativeSelect
            value={view}
            onChange={(ev) => setView(ev.target.value)}
            aria-label="Show registered items"
          >
            <option value="current">Active and paused</option>
            <option value="archived">Archived</option>
          </NativeSelect>
        </label>
      )}
      {!items.length && (
        <p>
          {view === "archived" && !stockFilter
            ? "No archived medications or equipment."
            : "No medications or equipment in this list."}
        </p>
      )}
      <ul className="item-list">
        {items.map((t) => (
          <li key={t.id} className="tracked-item">
            <div className="registered-description">
              <strong>{t.name}</strong>
              <p>{e.scheduleLabel(t)}</p>
              {t.status === "paused" && <p>Paused · reminders stopped</p>}
              {t.status === "archived" && <p>Archived · reminders stopped</p>}
            </div>
            <Button aria-label={`Edit ${t.name}`} onClick={() => onEdit(t)}>
              Edit
            </Button>
            <div
              className="registered-actions"
              role="group"
              aria-label={`Manage ${t.name}`}
            >
              {t.status === "archived" ? (
                <Button onClick={() => request(t, "restore")}>Restore</Button>
              ) : (
                <>
                  <Button
                    onClick={() =>
                      request(t, t.status === "paused" ? "resume" : "pause")
                    }
                  >
                    {t.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                  <Button onClick={() => request(t, "archive")}>Archive</Button>
                </>
              )}
              <Button variant="danger" onClick={() => request(t, "delete")}>
                Delete
              </Button>
            </div>
            {t.inventory.enabled && (
              <StockSummary
                state={state}
                treatment={t}
                onAdjust={(kind) => onAdjust(t.id, kind)}
              />
            )}
          </li>
        ))}
      </ul>
      {confirmation &&
        portal.current &&
        createPortal(
          <Modal
            title={`${labels[confirmation.intent]} ${confirmation.treatment.name}?`}
            onClose={dismiss}
          >
            <p>
              {confirmation.intent === "delete"
                ? "This removes the registered entry and stops all its reminders. You cannot restore this entry. Past taken/skipped records and stock history are kept."
                : confirmation.intent === "archive"
                  ? "Move this entry to Archived and stop all its reminders. You can restore it later. Past records and stock are kept."
                  : confirmation.intent === "pause"
                    ? "Stop all reminders for this entry, including repeats and snoozes. It stays in this list so you can resume it later. Past records and stock are kept."
                    : "Use the saved schedule from now. Reminders from the time it was inactive will not be added. Past records and stock are kept."}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="registered-actions">
              <Button
                disabled={operation.busy || operation.uncertain}
                onClick={dismiss}
              >
                Cancel
              </Button>
              <Button
                variant={
                  confirmation.intent === "delete" ? "destructive" : "primary"
                }
                disabled={
                  operation.busy ||
                  operation.uncertain ||
                  operation.conflict ||
                  operation.offline
                }
                onClick={async () => {
                  const { treatment, intent } = confirmation;
                  const result = await save(
                    intent === "delete"
                      ? {
                          action: "delete_treatment",
                          treatmentId: treatment.id,
                        }
                      : {
                          action: "set_treatment_status",
                          treatmentId: treatment.id,
                          status:
                            intent === "pause"
                              ? "paused"
                              : intent === "archive"
                                ? "archived"
                                : "active",
                        },
                  );
                  if (result) setError(result);
                  else dismiss();
                }}
              >
                {operation.busy ? "Saving…" : labels[confirmation.intent]}
              </Button>
            </div>
          </Modal>,
          portal.current,
        )}
    </section>
  );
}
