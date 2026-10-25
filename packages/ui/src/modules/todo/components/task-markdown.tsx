"use client";
import { useContext, useEffect, useRef } from "react";
import { renderTaskMarkdown } from "../lib/task-markdown";
import { RuntimeContext } from "../../../features/runtime";
export function TaskMarkdown({ content }: { content: string }) {
  const runtime = useContext(RuntimeContext),
    container = useRef<HTMLDivElement>(null);
  const native = Boolean(runtime?.image);
  const html = renderTaskMarkdown(
    content,
    native ? { imageSource: () => null } : {},
  );
  useEffect(() => {
    if (!runtime?.image) return;
    let active = true;
    const releases: (() => void)[] = [];
    for (const node of container.current?.querySelectorAll<HTMLElement>(
      "[data-task-image]",
    ) ?? []) {
      void runtime
        .image(node.dataset.taskImage!)
        .then((resource) => {
          if (!active) {
            resource.release();
            return;
          }
          releases.push(resource.release);
          const image = document.createElement("img");
          image.src = resource.url;
          image.alt = node.getAttribute("aria-label") ?? "Task image";
          image.decoding = "async";
          node.replaceWith(image);
        })
        .catch(() => {
          if (active)
            node.textContent = "Image unavailable. Reopen notes to retry.";
        });
    }
    return () => {
      active = false;
      releases.forEach((release) => release());
    };
  }, [runtime, html]);
  return (
    <div
      ref={container}
      className="task-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
