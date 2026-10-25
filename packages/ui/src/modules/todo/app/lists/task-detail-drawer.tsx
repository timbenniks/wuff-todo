"use client";
import { containDialogFocus } from "../../../../features/components/dialog-focus";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { lazy, Suspense } from "react";
import { useRuntime } from "../../../../features/runtime";
import type { TodoList } from "@wuff/contracts";
import { listThemeVariables } from "../../lib/list-theme";
import { Button } from "../../../../button";
import type { ListChange } from "./list-settings";

const TaskDetailContent = lazy(() =>
  import("../tasks/[id]/task-detail-content").then((module) => ({
    default: module.TaskDetailContent,
  })),
);

export function TaskDetailDrawer({
  taskId,
  list,
  userId,
  busy,
  error,
  retry,
  change,
  refresh,
  navigate,
}: {
  taskId: string;
  list: TodoList;
  userId: string;
  busy: boolean;
  error: string;
  retry?: () => Promise<boolean>;
  change: ListChange;
  refresh: () => Promise<void>;
  navigate: (taskId: string | null) => void;
}) {
  const runtime = useRuntime();
  const dialog = useRef<HTMLDialogElement>(null);
  const [leave, setLeave] = useState<
    { taskId: string | null } | { href: string } | null
  >(null);
  const [notice, setNotice] = useState("");
  const task = list.tasks.find((task) => task.id === taskId);
  const pendingWrite = useRef(busy || !!retry);
  pendingWrite.current = busy || !!retry;
  const hasDraft = () =>
    !!dialog.current?.querySelector('[data-unsaved="true"]');
  const isWriting = () =>
    busy ||
    !!retry ||
    !!dialog.current?.querySelector('[data-task-busy="true"]');
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    element
      ?.querySelector<HTMLButtonElement>('[aria-label="Close task details"]')
      ?.focus();
    document.body.style.overflow = "hidden";
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        pendingWrite.current ||
        element?.querySelector('[data-unsaved="true"], [data-task-busy="true"]')
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      window.removeEventListener("beforeunload", beforeUnload);
      requestAnimationFrame(() => {
        if (trigger?.isConnected && trigger.getClientRects().length)
          trigger.focus();
        else document.querySelector<HTMLElement>("#list-content")?.focus();
      });
    };
  }, []);
  useEffect(() => {
    if (leave)
      dialog.current
        ?.querySelector<HTMLElement>(".task-leave-notice button")
        ?.focus();
  }, [leave]);
  function finish(next: NonNullable<typeof leave>) {
    if ("href" in next) runtime.navigate(next.href);
    else navigate(next.taskId);
  }
  function requestLeave(next: NonNullable<typeof leave>) {
    if (isWriting()) {
      setNotice("Finish or retry the pending change before leaving this task.");
      return;
    }
    if (hasDraft()) setLeave(next);
    else finish(next);
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      onKeyDown={containDialogFocus}
      ref={dialog}
      className="task-drawer"
      style={listThemeVariables(list.color)}
      aria-label="Task details"
      onCancel={(event) => {
        event.preventDefault();
        requestLeave({ taskId: null });
      }}
      onClick={(event) => {
        if (event.target === dialog.current) requestLeave({ taskId: null });
      }}
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          "a[href]",
        );
        if (
          anchor &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !anchor.target &&
          !anchor.getAttribute("href")?.startsWith("#") &&
          hasDraft()
        ) {
          event.preventDefault();
          event.stopPropagation();
          requestLeave({ href: anchor.href });
        }
      }}
    >
      <header className="task-drawer-header">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{list.title}</p>
          <h2 className="text-sm font-semibold">Task details</h2>
        </div>
        <div className="flex items-center">
          {task && (
            <a
              className="task-drawer-link"
              href={runtime.webOrigin + task.path}
              target="_blank"
              rel="noreferrer"
              aria-label="Open task in a new tab"
              title="Open task in a new tab"
            >
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close task details"
            autoFocus
            onClick={() => requestLeave({ taskId: null })}
          >
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div className="task-drawer-body" key={taskId}>
        {leave && (
          <div role="alert" className="task-leave-notice">
            <p>You have unsaved edits. Discard them and leave this task?</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (!isWriting()) {
                    const next = leave;
                    setLeave(null);
                    finish(next);
                  }
                }}
              >
                Discard edits
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLeave(null)}
              >
                Keep editing
              </Button>
            </div>
          </div>
        )}
        {(error || notice) && (
          <p role={error ? "alert" : "status"} className="task-drawer-notice">
            {error || notice}
          </p>
        )}
        {retry && (
          <Button type="button" disabled={busy} onClick={retry}>
            Retry same request
          </Button>
        )}
        <p role="status" className="sr-only">
          {busy ? "Saving…" : ""}
        </p>
        {task ? (
          <Suspense fallback={<p role="status">Opening task details…</p>}>
            <TaskDetailContent
              key={task.id}
              task={task}
              list={list}
              userId={userId}
              busy={busy}
              change={change}
              refresh={refresh}
              onNotice={setNotice}
              onError={setNotice}
              onOpenTask={(id) => requestLeave({ taskId: id })}
            />
          </Suspense>
        ) : (
          <p role="status">
            This task is no longer available. It may have been removed or your
            access changed.
          </p>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
