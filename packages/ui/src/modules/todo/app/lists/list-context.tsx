"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronRight, Users } from "lucide-react";
import { listNavigationContext, type ListSummary } from "@wuff/contracts";
import { NativeSelect } from "../../../../native-select";
import { captureMatchesList } from "../../lib/task-presentation";
import { listPalette } from "../../lib/list-colors";

/** Transient navigation only. Keep tasks mounted so tab changes preserve drafts. */
export function ListContext({
  lists,
  id,
  choose,
  taskCount,
  children: tasks,
}: {
  lists: ListSummary[];
  id: string;
  choose: (id: string) => void;
  taskCount: number;
  children: ReactNode;
}) {
  const { parent, children, siblings } = listNavigationContext(lists, id);
  const [selection, setSelection] = useState({ id, tab: "tasks" });
  const sublists = children.length > 0;
  const active = sublists && selection.id === id ? selection.tab : "tasks";
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const navigationFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // Removal may move focus to body before React's effects run. Retain the
      // removed target, but clear it when the user focuses another real control.
      if (
        target === document.body &&
        navigationFocus.current &&
        !navigationFocus.current.isConnected
      )
        return;
      navigationFocus.current =
        panel.current?.contains(target) ||
        tabs.current.some((tab) => tab === target)
          ? target
          : null;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  useEffect(() => {
    const capture = (event: Event) => {
      if (captureMatchesList((event as CustomEvent).detail, id))
        setSelection({ id, tab: "tasks" });
    };
    window.addEventListener("wuff:todo:capture", capture);
    return () => window.removeEventListener("wuff:todo:capture", capture);
  }, [id]);
  useLayoutEffect(() => {
    if (!sublists) {
      const previous = navigationFocus.current;
      if (
        previous &&
        (!previous.isConnected || previous.closest("[hidden]")) &&
        (document.activeElement === document.body ||
          document.activeElement === previous)
      )
        document.querySelector<HTMLElement>("#list-content")?.focus();
      navigationFocus.current = null;
      if (selection.tab === "lists") setSelection({ id, tab: "tasks" });
    }
  }, [sublists, id, selection.tab]);
  return (
    <>
      {parent && (
        <nav className="list-context list-location" aria-label="List location">
          <button
            className="list-parent-link"
            onClick={() => choose(parent.id)}
          >
            ← {parent.title}
          </button>
          {siblings.length > 0 && (
            <label>
              <span className="sr-only">Sibling lists</span>
              <NativeSelect
                value=""
                aria-label="Sibling lists"
                onChange={(event) => {
                  if (event.target.value) choose(event.target.value);
                }}
              >
                <option value="">Other sublists</option>
                {siblings.map((sibling) => (
                  <option key={sibling.id} value={sibling.id}>
                    {sibling.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
        </nav>
      )}
      {sublists && (
        <div
          className="list-content-tabs"
          role="tablist"
          aria-label="List content"
        >
          {(["tasks", "lists"] as const).map((tab, index) => (
            <button
              key={tab}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-${tab}-tab`}
              aria-controls={`${id}-${tab}-panel`}
              aria-selected={active === tab}
              tabIndex={active === tab ? 0 : -1}
              onClick={() => setSelection({ id, tab })}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 1
                      : 1 - index;
                setSelection({ id, tab: next === 0 ? "tasks" : "lists" });
                tabs.current[next]?.focus();
              }}
            >
              {tab === "tasks" ? "Tasks" : "Sublists"}
              <span>{tab === "tasks" ? taskCount : children.length}</span>
            </button>
          ))}
        </div>
      )}
      <div
        id={`${id}-tasks-panel`}
        role={sublists ? "tabpanel" : undefined}
        aria-labelledby={sublists ? `${id}-tasks-tab` : undefined}
        hidden={active !== "tasks"}
      >
        {tasks}
      </div>
      <div
        ref={panel}
        id={`${id}-lists-panel`}
        className="sublist-directory"
        role={sublists ? "tabpanel" : undefined}
        aria-labelledby={sublists ? `${id}-lists-tab` : undefined}
        hidden={!sublists || active !== "lists"}
      >
        <ul aria-label="Sublists">
          {children.map((child) => (
            <li key={child.id}>
              <button type="button" onClick={() => choose(child.id)}>
                <span
                  className="sublist-color"
                  style={{ background: listPalette[child.color].accent }}
                  aria-hidden="true"
                />
                <span className="sublist-name">{child.title}</span>
                {child.shared && <Users size={16} aria-label="Shared list" />}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
