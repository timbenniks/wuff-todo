"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "../../button";
import { NativeSelect } from "../../native-select";
import { Input } from "../../input";
import { useActorApi } from "../actor-api";
import { ApiError } from "../api";
import {
  totakeEngine as e,
  type TotakeSnapshot,
  type TotakeAction,
  type TotakeMutation,
  type SetupDraft,
  type Treatment,
} from "@wuff/contracts";
import {
  dayDate,
  weekStart,
  monthStart,
  monthGrid,
  monthLabel,
  monthShift,
  fullDate,
} from "@wuff/contracts/totake/calendar";
import { SetupWizard } from "./SetupWizard";
import { OneTimeFlow, IntakeHistory } from "./OneTimeFlow";
import { StockSummary, StockAdjustment } from "./StockControls";
import { RecordedGroups, ItemName, SnoozeControls } from "./components";
import { ReminderTimeEditor } from "./ReminderTimeEditor";
import { acceptTotakeRead, createTotakeReadGate } from "./request";
import { Modal, TotakeSaveContext } from "./Modal";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  Pill,
  Bell,
  Settings2,
} from "lucide-react";

type Page = "daily" | "items" | "settings";
export function TotakeApp({
  initial,
  userId,
  initialPage = "daily",
}: {
  initial: TotakeSnapshot;
  userId: string;
  initialPage?: Page;
}) {
  const draftVersion = useRef<number | null>(null);
  const api = useActorApi();
  const [data, setData] = useState(initial),
    live = useRef(initial);
  live.current = data;
  const [page, setPage] = useState<Page>(initialPage),
    [menu, setMenu] = useState(false);
  const [day, setDay] = useState(Math.floor(initial.state.now / 1440)),
    [week, setWeek] = useState(weekStart(day)),
    [month, setMonth] = useState(monthStart(day)),
    [calendar, setCalendar] = useState(false);
  const [add, setAdd] = useState(false),
    [wizard, setWizard] = useState<{
      draft: SetupDraft;
      original?: Treatment;
      dirty?: boolean;
    } | null>(null),
    [intake, setIntake] = useState<e.IntakeDraft | null>(null);
  const draftCache = useRef(
    new Map<
      string,
      { draft: SetupDraft; original?: Treatment; dirty?: boolean }
    >(),
  );
  const intakeCache = useRef<{ draft: e.IntakeDraft; dirty: boolean } | null>(
    null,
  );
  const [active, setActive] = useState<string | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [minutes, setMinutes] = useState(30),
    [moving, setMoving] = useState<{
      group: e.Occurrence;
      itemId: string;
    } | null>(null),
    [stock, setStock] = useState<{
      id: string;
      kind: "add" | "correct";
    } | null>(null);
  const readFailed = useRef(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false),
    inFlight = useRef(false),
    pending = useRef<TotakeMutation | null>(null),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [repeat, setRepeat] = useState(initial.state.defaultRepeat),
    [zone, setZone] = useState(initial.state.clock!.zone),
    [stockFilter, setStockFilter] = useState<string[] | null>(null);
  const s = data.state,
    today = Math.floor(s.now / 1440),
    groups = s.groups.filter((g) => Math.floor(g.due / 1440) === day),
    group = s.groups.find((g) => g.id === active);
  const warnings = useMemo(() => e.lowStockWarnings(s), [s]),
    strip = e.warningStrip(warnings);
  const readGate = useRef(createTotakeReadGate());
  const selection = useRef(new Map<string, string[]>());
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("reminder");
    if (!id) return;
    const g = initial.state.groups.find((g) => g.id === id);
    if (g) {
      setDay(Math.floor(g.due / 1440));
      setWeek(weekStart(Math.floor(g.due / 1440)));
      if (e.pending(g).length) {
        draftVersion.current = initial.version;
        setSelected(e.pending(g).map((i) => i.id));
        setActive(g.id);
      } else setNotice("This reminder already has a record.");
    } else
      setNotice(
        "This reminder is no longer available. The latest overview is shown.",
      );
  }, []);

  async function refresh(through?: number, explicit = false) {
    if (inFlight.current || pending.current) return null;
    const generation = readGate.current.begin(explicit);
    if (generation === null) return null;
    try {
      const next = await api<TotakeSnapshot>(
        "/api/v1/totake" + (through !== undefined ? "?day=" + through : ""),
      );
      if (next.userId !== userId)
        throw Error("Your account changed. Reload Wuff.");
      if (
        !readGate.current.current(generation) ||
        !acceptTotakeRead(live.current, next)
      )
        return null;
      if (!inFlight.current && !pending.current) {
        live.current = next;
        setData(next);
        if (readFailed.current) setError("");
        readFailed.current = false;
        setOffline(false);
      }
      return next;
    } catch (err) {
      if (!readGate.current.current(generation)) return null;
      readFailed.current = true;
      setOffline(true);
      setError(
        err instanceof Error ? err.message : "Could not refresh Totake.",
      );
      return null;
    } finally {
      readGate.current.finish(generation);
    }
  }
  useEffect(() => {
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(focus, 10000);
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [api, userId]);
  async function send(request: TotakeMutation): Promise<string | null> {
    if (inFlight.current) return "A change is already saving.";
    inFlight.current = true;
    readGate.current.invalidate();
    setBusy(true);
    setError("");
    try {
      const next = await api<TotakeSnapshot>("/api/v1/totake", "PUT", request);
      if (next.userId !== userId)
        throw Error("Your account changed. Reload Wuff.");
      live.current = next;
      setData(next);
      pending.current = null;
      setUncertain(false);
      setConflict(false);
      setNotice("Saved to your private Wuff account.");
      return null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not confirm this save.";
      if (err instanceof ApiError && err.status < 500) {
        pending.current = null;
        setUncertain(false);
        if (err.status === 409) setConflict(true);
      } else {
        pending.current = request;
        setUncertain(true);
      }
      setError(message);
      return message;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save(change: TotakeAction): Promise<string | null> {
    if (readFailed.current)
      return "Reconnect and refresh Totake before saving. Your draft is kept.";
    if (pending.current)
      return "Retry the unconfirmed save before making another change.";
    if (conflict) return "Load the latest data before saving.";
    return send({
      operationId: crypto.randomUUID(),
      version: draftVersion.current ?? live.current.version,
      change,
    });
  }
  function selectDay(d: number) {
    if (d > (live.current.state.planHorizon ?? 0)) void refresh(d);
    setDay(d);
    setWeek(weekStart(d));
    setCalendar(false);
    setPage("daily");
  }
  const closeDraft = () => {
    draftVersion.current = null;
    setWizard(null);
    setAdd(false);
    draftCache.current.clear();
    intakeCache.current = null;
    setIntake(null);
  };
  const nav = [
    ["daily", "Daily overview", CalendarDays],
    ["items", "Medications & equipment", Pill],
    ["settings", "Notification settings", Bell],
  ] as const;
  const navigation = (
    <nav aria-label="Totake pages">
      {nav.map(([id, label, Icon]) => (
        <Button
          key={id}
          variant="ghost"
          className="sidebar-nav-item"
          aria-current={page === id ? "page" : undefined}
          onClick={() => {
            setPage(id);
            if (id === "settings") {
              draftVersion.current = live.current.version;
              setRepeat(live.current.state.defaultRepeat);
              setZone(live.current.state.clock!.zone);
            } else draftVersion.current = null;
            setMenu(false);
            setStockFilter(null);
          }}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Button>
      ))}
    </nav>
  );
  const start = (
    kind: Treatment["kind"],
    type: Treatment["equipmentType"] = "custom",
  ) => {
    const key = kind === "medication" ? kind : type;
    draftVersion.current ??= live.current.version;
    setWizard(
      draftCache.current.get(key) ?? {
        draft: e.newTreatment(kind, type, today, s.defaultRepeat),
      },
    );
    setAdd(false);
  };
  async function record(
    g: e.Occurrence,
    ids: string[],
    outcome: "taken" | "skipped",
  ) {
    if (
      !(await save({ action: "record", groupId: g.id, itemIds: ids, outcome }))
    ) {
      setActive(null);
      draftVersion.current = null;
    }
  }
  async function retry() {
    const request = pending.current;
    if (request && !(await send(request))) {
      closeDraft();
      setStock(null);
      setMoving(null);
      setActive(null);
    }
  }
  async function loadLatest() {
    const next = await refresh(undefined, true);
    if (next) {
      draftVersion.current = next.version;
      setConflict(false);
      setError("");
      setNotice(
        "Latest data loaded. Review your retained draft before saving.",
      );
    }
  }
  return (
    <TotakeSaveContext.Provider
      value={{ busy, uncertain, conflict, offline, retry, loadLatest }}
    >
      <div
        className={
          initialPage === "settings" ? "totake totake-settings-only" : "totake"
        }
      >
        <div className="totake-layout">
          <aside className="totake-sidebar app-sidebar">
            <div className="sidebar-brand flex gap-2.5 items-center md:mb-5">
              <a
                className="workspace-brand-link flex gap-2.5 items-center"
                href="/"
                aria-label="Wuff Totake · Empire dashboard"
              >
                <span className="wordmark text-xl font-bold">Wuff Totake</span>
              </a>
              <Button
                className="totake-menu ml-auto"
                variant="ghost"
                aria-label="Totake menu"
                aria-haspopup="dialog"
                aria-expanded={menu}
                onClick={() => setMenu(true)}
              >
                <Menu size={20} aria-hidden="true" />
                Menu
              </Button>
            </div>
            <div className="totake-desktop-nav">{navigation}</div>
            <div className="totake-sidebar-footer">
              <a className="sidebar-settings sidebar-nav-item" href="/settings">
                <Settings2 size={17} aria-hidden="true" />
                Settings
              </a>
            </div>
          </aside>
          <main id="empire-content" className="totake-main" aria-busy={busy}>
            <header className="module-heading">
              <div>
                <p className="eyebrow">Wuff Totake</p>
                <h1 id="page-title" tabIndex={-1}>
                  {page === "daily"
                    ? "Daily overview"
                    : page === "items"
                      ? "Medications & equipment"
                      : "Notification settings"}
                </h1>
              </div>
              {page !== "settings" && (
                <Button
                  variant="primary"
                  disabled={busy || uncertain || offline}
                  onClick={() => {
                    draftCache.current.clear();
                    intakeCache.current = null;
                    draftVersion.current = live.current.version;
                    setAdd(true);
                  }}
                >
                  <Plus size={18} />
                  Add
                </Button>
              )}
            </header>
            {!data.delivery.enabled && (
              <p className="settings-description">
                Reminders are not being delivered yet.{" "}
                <a href="/settings/notifications">Notification setup</a>
              </p>
            )}
            <p role="status">{busy ? "Saving…" : notice}</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {offline && (
              <div role="alert">
                <p>
                  Totake could not refresh. The displayed snapshot may be out of
                  date. Your draft is kept.
                </p>
                <Button onClick={() => void refresh(undefined, true)}>
                  Refresh Totake
                </Button>
              </div>
            )}
            {uncertain && (
              <Button
                disabled={busy}
                onClick={async () => {
                  const request = pending.current;
                  if (request && !(await send(request))) {
                    setWizard(null);
                    setIntake(null);
                    setStock(null);
                    setMoving(null);
                    setActive(null);
                  }
                }}
              >
                Retry the same save
              </Button>
            )}
            {conflict && (
              <Button
                disabled={busy}
                onClick={async () => {
                  await loadLatest();
                }}
              >
                Load latest data
              </Button>
            )}
            <fieldset
              className="totake-operation-scope"
              disabled={busy || uncertain || conflict || offline}
            >
              {page === "daily" && (
                <>
                  {strip && (
                    <Button
                      variant="outline"
                      className="stock-warning-strip warning-surface"
                      data-tone={strip.tone}
                      onClick={() => {
                        setStockFilter(warnings.map((w) => w.id));
                        setPage("items");
                      }}
                    >
                      {strip.text}
                    </Button>
                  )}
                  <section
                    className="date-navigation"
                    aria-label="Schedule calendar"
                  >
                    <div className="week-controls">
                      <div className="week-navigation">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Previous week"
                          onClick={() => setWeek((v) => v - 7)}
                        >
                          <ChevronLeft />
                        </Button>
                        <h2>{monthLabel(week + 3)}</h2>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Next week"
                          onClick={() => setWeek((v) => v + 7)}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                      <div className="week-actions">
                        <Button onClick={() => selectDay(today)}>Today</Button>
                        <Button
                          size="icon"
                          aria-label="Open month calendar"
                          onClick={() => {
                            setMonth(monthStart(day));
                            setCalendar(true);
                          }}
                        >
                          <CalendarDays />
                        </Button>
                      </div>
                    </div>
                    <div className="week-strip">
                      {Array.from({ length: 7 }, (_, i) => week + i).map(
                        (d) => (
                          <Button
                            variant="ghost"
                            className="week-day"
                            key={d}
                            aria-pressed={d === day}
                            aria-label={`${fullDate(d)} · ${e.dayStatus(s, d)}`}
                            onClick={() => selectDay(d)}
                          >
                            <small>
                              {dayDate(d).toLocaleDateString("en-GB", {
                                weekday: "short",
                                timeZone: "UTC",
                              })}
                            </small>
                            <strong
                              className="date-number"
                              data-state={e.dayStatus(s, d)}
                            >
                              {dayDate(d).getUTCDate()}
                            </strong>
                          </Button>
                        ),
                      )}
                    </div>
                  </section>
                  <h2>{day === today ? "Today" : fullDate(day)}</h2>
                  {!groups.length && (
                    <section className="card empty">
                      <h3>Nothing scheduled for this day</h3>
                      <p>
                        Add a medication or equipment change, or choose another
                        date.
                      </p>
                    </section>
                  )}
                  <div className="groups">
                    {groups
                      .filter((g) => e.pending(g).length)
                      .map((g) => (
                        <article className="card group" key={g.id}>
                          <div className="group-top">
                            <div>
                              <h3>
                                {e.time(g.due)} · {g.title}
                              </h3>
                              <p
                                className={
                                  e.reminderTiming(s, g) === "overdue"
                                    ? "overdue"
                                    : ""
                                }
                              >
                                {e.reminderTiming(s, g) === "overdue"
                                  ? "Overdue · unrecorded"
                                  : "Scheduled · unrecorded"}
                              </p>
                            </div>
                          </div>
                          <ul className="item-list">
                            {e.pending(g).map((i) => (
                              <li key={i.id}>
                                <ItemName item={i} />
                                <Button
                                  aria-label={`Mark ${i.name} as ${i.kind === "equipment" ? "done" : "taken"}`}
                                  onClick={() => record(g, [i.id], "taken")}
                                >
                                  {i.kind === "equipment" ? "Done" : "Taken"}
                                </Button>
                              </li>
                            ))}
                          </ul>
                          <div className="group-footer">
                            <Button
                              variant="primary"
                              onClick={() =>
                                record(
                                  g,
                                  e.pending(g).map((i) => i.id),
                                  "taken",
                                )
                              }
                            >
                              All done
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                draftVersion.current = live.current.version;
                                setSelected(
                                  selection.current.get(g.id) ??
                                    e.pending(g).map((i) => i.id),
                                );
                                setActive(g.id);
                              }}
                            >
                              View reminder
                            </Button>
                          </div>
                        </article>
                      ))}
                  </div>
                  <details className="card recorded">
                    <summary>
                      {day === today
                        ? "Recorded today"
                        : "Recorded for this day"}
                    </summary>
                    <RecordedGroups
                      groups={groups.filter((g) => g.records.length)}
                      stockMovements={s.stock?.movements}
                      onUndo={(g, id) =>
                        void save({
                          action: "undo",
                          groupId: g.id,
                          recordId: id,
                        })
                      }
                    />
                    <IntakeHistory
                      intakes={(s.intakes ?? []).filter(
                        (i) => Math.floor(i.at / 1440) === day && !i.undone,
                      )}
                      state={s}
                      onUndo={(id) =>
                        void save({ action: "undo_intake", intakeId: id })
                      }
                    />
                  </details>
                </>
              )}
              {page === "items" && (
                <section className="card registered">
                  <h2>{stockFilter ? "Low stock" : "Registered items"}</h2>
                  {stockFilter && (
                    <Button onClick={() => setStockFilter(null)}>
                      Show all items
                    </Button>
                  )}
                  {!s.treatments?.length && (
                    <p>No medications or equipment registered yet.</p>
                  )}
                  <ul className="item-list">
                    {s.treatments
                      ?.filter(
                        (t) => !stockFilter || stockFilter.includes(t.id),
                      )
                      .map((t) => (
                        <li key={t.id} className="tracked-item">
                          <div className="registered-description">
                            <strong>{t.name}</strong>
                            <p>{e.scheduleLabel(t)}</p>
                          </div>
                          <Button
                            aria-label={`Edit ${t.name}`}
                            onClick={() => (
                              (draftVersion.current = live.current.version),
                              setWizard({
                                draft: {
                                  ...structuredClone(t),
                                  groupIntervals: {},
                                  groupEdits: {},
                                },
                                original: t,
                              })
                            )}
                          >
                            Edit
                          </Button>
                          {t.inventory.enabled && (
                            <StockSummary
                              state={s}
                              treatment={t}
                              onAdjust={(kind) => {
                                draftVersion.current = live.current.version;
                                setStock({ id: t.id, kind });
                              }}
                            />
                          )}
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              {page === "settings" && (
                <section className="card settings-card">
                  <h2>Personal reminder preferences</h2>
                  <label htmlFor="totake-repeat">Default repeat interval</label>
                  <NativeSelect
                    id="totake-repeat"
                    value={repeat}
                    onChange={(ev) => setRepeat(Number(ev.target.value))}
                  >
                    {[5, 10, 15, 20, 30].map((n) => (
                      <option key={n} value={n}>
                        {n} minutes
                      </option>
                    ))}
                  </NativeSelect>
                  <label htmlFor="totake-zone">Schedule timezone</label>
                  <Input
                    id="totake-zone"
                    value={zone}
                    onChange={(ev) => setZone(ev.target.value)}
                  />
                  <Button
                    variant="primary"
                    onClick={() =>
                      save({
                        action: "settings",
                        repeat: repeat as 30,
                        timezone: zone,
                      })
                    }
                  >
                    Save preferences
                  </Button>
                  <a href="/settings/notifications">
                    Devices and shared notification controls
                  </a>
                  <p role="status">{data.delivery.message}</p>
                </section>
              )}
            </fieldset>
          </main>
        </div>
        {menu && (
          <Modal
            title="Totake menu"
            className="totake-navigation-dialog"
            onClose={() => setMenu(false)}
          >
            <div className="totake-navigation-body">
              {navigation}
              <a className="sidebar-settings sidebar-nav-item" href="/settings">
                <Settings2 size={17} aria-hidden="true" />
                Settings
              </a>
            </div>
          </Modal>
        )}
        {calendar && (
          <Modal
            title="Choose a date"
            onClose={() => setCalendar(false)}
            className="calendar-dialog"
          >
            <div className="calendar-body">
              <div className="month-controls">
                <Button
                  aria-label="Previous month"
                  onClick={() => setMonth((d) => monthShift(d, -1))}
                >
                  <ChevronLeft />
                </Button>
                <h3>{monthLabel(month)}</h3>
                <Button
                  aria-label="Next month"
                  onClick={() => setMonth((d) => monthShift(d, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="month-weekdays" aria-hidden="true">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="month-grid">
                {monthGrid(month).map((d) => (
                  <Button
                    key={d}
                    variant="ghost"
                    className="month-day"
                    aria-label={`${fullDate(d)} · ${e.dayStatus(s, d)}`}
                    aria-pressed={d === day}
                    onClick={() => selectDay(d)}
                  >
                    <span
                      className="date-number"
                      data-state={e.dayStatus(s, d)}
                    >
                      {dayDate(d).getUTCDate()}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </Modal>
        )}
        {add && (
          <Modal
            title="Add an item"
            onClose={closeDraft}
            dirty={
              !!intakeCache.current?.dirty ||
              [...draftCache.current.values()].some((d) => d.dirty)
            }
          >
            <div className="destination-body">
              <Button onClick={() => start("medication")}>Medication</Button>
              <h3>Equipment change</h3>
              {(["sensor", "catheter", "custom"] as const).map((type) => (
                <Button key={type} onClick={() => start("equipment", type)}>
                  {type === "sensor"
                    ? "Sensor"
                    : type === "catheter"
                      ? "Catheter"
                      : "Custom equipment"}
                </Button>
              ))}
              <div className="add-one-time">
                <Button
                  onClick={() => {
                    setAdd(false);
                    setIntake(intakeCache.current?.draft ?? e.newIntake(s));
                  }}
                >
                  One-time entry
                </Button>
              </div>
            </div>
          </Modal>
        )}
        {wizard && (
          <SetupWizard
            key={wizard.draft.id}
            initial={wizard.draft}
            original={wizard.original}
            initialDirty={
              wizard.dirty ||
              [...draftCache.current.values()].some((d) => d.dirty) ||
              !!intakeCache.current?.dirty
            }
            state={s}
            onCancel={closeDraft}
            onFirstBack={(draft, dirty) => {
              draftCache.current.set(
                draft.kind === "medication"
                  ? "medication"
                  : draft.equipmentType,
                { draft, dirty, original: wizard.original },
              );
              setWizard(null);
              setAdd(true);
            }}
            onSave={async (draft) => {
              const error = await save({ action: "save_treatment", draft });
              if (!error) closeDraft();
              return error;
            }}
          />
        )}
        {intake && (
          <OneTimeFlow
            initial={intake}
            state={s}
            initialDirty={
              intakeCache.current?.dirty ||
              [...draftCache.current.values()].some((d) => d.dirty)
            }
            onCancel={closeDraft}
            onBack={(draft, dirty) => {
              intakeCache.current = { draft, dirty };
              setIntake(null);
              setAdd(true);
            }}
            onSave={async (draft) => {
              const error = await save({ action: "record_intake", draft });
              if (!error) {
                closeDraft();
                selectDay(Math.floor(e.intakeWall(draft) / 1440));
              }
              return error;
            }}
          />
        )}
        {stock && (
          <StockAdjustment
            treatment={s.treatments!.find((t) => t.id === stock.id)!}
            kind={stock.kind}
            onCancel={() => setStock(null)}
            onSave={async (quantity) => {
              const error = await save({
                action: "adjust_stock",
                treatmentId: stock.id,
                kind: stock.kind,
                quantity,
              });
              if (!error) setStock(null);
              return error;
            }}
          />
        )}
        {moving && (
          <ReminderTimeEditor
            group={moving.group}
            item={moving.group.items.find((i) => i.id === moving.itemId)!}
            state={s}
            onCancel={() => setMoving(null)}
            onSave={async (toDue, scope, acceptProposal) => {
              const error = await save({
                action: "move_reminder",
                groupId: moving.group.id,
                itemId: moving.itemId,
                toDue,
                scope,
                acceptProposal,
              });
              if (!error) setMoving(null);
              return error;
            }}
          />
        )}
        {group && (
          <Modal
            title="View reminder"
            onClose={() => {
              selection.current.set(group.id, selected);
              setActive(null);
            }}
            className="full-screen-alert"
          >
            <div className="full-alert-body">
              <h2>
                {e.time(group.due)} · {group.title}
              </h2>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              {uncertain && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    if (pending.current && !(await send(pending.current)))
                      setActive(null);
                  }}
                >
                  Retry the same save
                </Button>
              )}
              <fieldset disabled={busy || uncertain || conflict || offline}>
                <legend>
                  {
                    selected.filter((id) =>
                      e.pending(group).some((i) => i.id === id),
                    ).length
                  }{" "}
                  selected
                </legend>
                {e.pending(group).map((i) => (
                  <label className="selection-row" key={i.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(i.id)}
                      onChange={(ev) =>
                        setSelected((prev) =>
                          ev.target.checked
                            ? [...prev, i.id]
                            : prev.filter((id) => id !== i.id),
                        )
                      }
                    />
                    <ItemName item={i} />
                  </label>
                ))}
                <Button
                  variant="primary"
                  disabled={!selected.length}
                  onClick={() =>
                    record(
                      group,
                      selected.filter((id) =>
                        e.pending(group).some((i) => i.id === id),
                      ),
                      "taken",
                    )
                  }
                >
                  {e.pending(group).every((i) => selected.includes(i.id))
                    ? "All done"
                    : `Mark selected as taken/done (${selected.length})`}
                </Button>
                <Button
                  className="reminder-skip"
                  disabled={!selected.length}
                  onClick={() => record(group, selected, "skipped")}
                >
                  Skip selected
                </Button>
                <SnoozeControls
                  id="totake-snooze"
                  disabled={e
                    .pending(group)
                    .some(
                      (i) =>
                        selected.includes(i.id) &&
                        (i.alertInstant ?? Infinity) > s.clock!.instant,
                    )}
                  count={selected.length}
                  minutes={minutes}
                  onMinutes={setMinutes}
                  onSnooze={async () => {
                    if (
                      !(await save({
                        action: "snooze",
                        groupId: group.id,
                        itemIds: selected,
                        minutes: minutes as 30,
                      }))
                    )
                      setActive(null);
                  }}
                  showExplanation={false}
                />
                <details>
                  <summary>Change a reminder’s date/time</summary>
                  {e.pending(group).map((i) => (
                    <Button
                      key={i.id}
                      onClick={() => {
                        setMoving({ group, itemId: i.id });
                        setActive(null);
                      }}
                    >
                      {i.name}
                    </Button>
                  ))}
                </details>
              </fieldset>
            </div>
          </Modal>
        )}
      </div>
    </TotakeSaveContext.Provider>
  );
}
