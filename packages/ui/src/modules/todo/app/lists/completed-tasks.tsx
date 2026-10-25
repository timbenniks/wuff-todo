"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import type { TodoList, ViewGroup } from "@wuff/contracts";
import { Button } from "../../../../button";
import type { ListChange } from "./list-settings";

export function CompletedTasks({
  list,
  groups,
  ids,
  busy,
  change,
  openTask,
}: {
  list: TodoList;
  groups: ViewGroup[];
  ids: Set<string>;
  busy: boolean;
  change: ListChange;
  openTask: (id: string) => void;
}) {
  const [notice, setNotice] = useState("");
  if (!ids.size && !notice) return null;
  return (
    <>
      {notice && (
        <p role="status" className="text-sm my-3">
          {notice}
        </p>
      )}
      {!!ids.size && (
        <details className="completed-task-group">
          <summary className="section-summary">Completed ({ids.size})</summary>
          <p className="text-xs text-muted-foreground mb-2">
            Open details or reopen a task. Recently completed rows stay above
            until you leave this list.
          </p>
          {groups.map((group) => {
            const tasks = group.tasks.filter((task) => ids.has(task.id));
            if (!tasks.length) return null;
            return (
              <div key={group.id}>
                {(list.sections.length > 0 || groups.length > 1) && (
                  <h3 className="text-xs text-muted-foreground mt-3">
                    {group.title}
                  </h3>
                )}
                {tasks.map((task) => (
                  <div key={task.id} className="completed-task-row">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Reopen ${task.title}`}
                      disabled={busy || list.archived}
                      onClick={async () => {
                        if (
                          await change("/api/v1/tasks", "PATCH", {
                            listId: list.id,
                            version: list.version,
                            taskId: task.id,
                            completed: false,
                          })
                        ) {
                          setNotice(
                            `Reopened “${task.title}”. Check its section and view filters if it isn’t visible.`,
                          );
                          requestAnimationFrame(() => {
                            const link =
                              document.querySelector<HTMLAnchorElement>(
                                `[data-task-id="${task.id}"] .task-name a`,
                              );
                            if (link?.getClientRects().length) link.focus();
                            else
                              document
                                .querySelector<HTMLButtonElement>(
                                  ".workspace-task-list .task-capture-trigger",
                                )
                                ?.focus();
                          });
                        }
                      }}
                    >
                      <Check size={20} aria-hidden="true" />
                    </Button>
                    <a
                      href={task.path}
                      className="min-h-11 flex items-center break-words min-w-0 text-muted-foreground"
                      aria-label={`Open completed task: ${task.title}`}
                      onClick={(event) => {
                        if (
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey &&
                          event.button === 0
                        ) {
                          event.preventDefault();
                          openTask(task.id);
                        }
                      }}
                    >
                      {task.title}
                    </a>
                  </div>
                ))}
              </div>
            );
          })}
        </details>
      )}
    </>
  );
}
