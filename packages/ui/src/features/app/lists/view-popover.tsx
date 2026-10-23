"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "../../../button";

export function ViewPopover({
  label,
  children,
  disabled = false,
  onOpen,
  className,
  ariaLabel,
  variant = "outline",
  panelLabel,
  showDone = true,
}: {
  label: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  onOpen?: () => void;
  className?: string;
  ariaLabel?: string;
  variant?: "outline" | "ghost";
  panelLabel?: string;
  showDone?: boolean;
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = panel.current,
        anchor = trigger.current;
      if (!el || !anchor) return;
      const r = anchor.getBoundingClientRect();
      el.style.maxHeight = `${Math.max(120, innerHeight - 24)}px`;
      el.style.left = `${Math.max(12, Math.min(r.left, innerWidth - el.offsetWidth - 12))}px`;
      el.style.top = `${Math.max(12, Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 12))}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    panel.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        aria-label={ariaLabel}
        id={`${id}-trigger`}
        ref={trigger}
        popoverTarget={id}
        onClick={() => {
          if (!panel.current?.matches(":popover-open")) onOpen?.();
        }}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
      >
        {label}
      </Button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-labelledby={panelLabel ? undefined : `${id}-trigger`}
        aria-label={panelLabel}
        className="view-popover"
        onToggle={(e) => {
          setOpen(e.newState === "open");
        }}
      >
        <div className="view-popover-content">{children}</div>
        {showDone && (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => panel.current?.hidePopover()}
          >
            Done
          </Button>
        )}
      </div>
    </>
  );
}
