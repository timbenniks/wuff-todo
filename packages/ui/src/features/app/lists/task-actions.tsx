"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../../../button";

export function TaskActions({
  title,
  disabled,
  trigger,
  children,
}: {
  title: string;
  disabled: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = trigger.current,
        menu = panel.current;
      if (!button || !menu) return;
      const rect = button.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12,
        above = rect.top - 12;
      const up = below < Math.min(menu.scrollHeight, 360) && above > below;
      menu.style.maxHeight = `${Math.max(80, up ? above : below)}px`;
      menu.style.left = `${Math.max(12, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 12))}px`;
      menu.style.top = `${up ? Math.max(12, rect.top - menu.offsetHeight - 4) : rect.bottom + 4}px`;
    };
    place();
    panel.current?.querySelector<HTMLElement>("button, a, select")?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, trigger]);
  return (
    <div className="task-actions">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        ref={trigger}
        popoverTarget={id}
        aria-label={`More actions for ${title}`}
        title="Task actions"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
      >
        <MoreHorizontal size={18} />
      </Button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        className="task-action-menu"
        aria-label={`Actions for ${title}`}
        onToggle={(event) => setOpen(event.newState === "open")}
      >
        <p className="task-menu-title">{title}</p>
        {children(() => panel.current?.hidePopover())}
      </div>
    </div>
  );
}
