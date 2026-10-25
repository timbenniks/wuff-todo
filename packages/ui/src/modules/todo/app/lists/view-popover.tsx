"use client";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../../../button";
import { ArrowLeft } from "lucide-react";

export type ViewSheet = {
  active: string | null;
  select: (id: string | null) => void;
};

export function ViewPopover({
  label,
  children,
  disabled = false,
  onOpen,
  onClose,
  className,
  ariaLabel,
  variant = "outline",
  panelLabel,
  showDone = true,
  sheet,
}: {
  label: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  className?: string;
  ariaLabel?: string;
  variant?: "outline" | "ghost";
  panelLabel?: string;
  showDone?: boolean;
  sheet?: ViewSheet;
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const sheetOpen = sheet?.active === id;
  useLayoutEffect(() => {
    if (sheetOpen)
      panel.current
        ?.querySelector<HTMLElement>("input, select, button")
        ?.focus();
  }, [sheetOpen]);
  useLayoutEffect(() => {
    if (sheet || !open) return;
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
  }, [open, sheet]);
  if (sheet)
    return (
      <>
        <Button
          type="button"
          variant={variant}
          className={className}
          aria-label={ariaLabel}
          ref={trigger}
          disabled={disabled}
          style={{ display: sheet.active !== null ? "none" : undefined }}
          aria-expanded={sheetOpen}
          aria-controls={id}
          onClick={() => {
            onOpen?.();
            sheet.select(id);
          }}
        >
          {label}
        </Button>
        {sheetOpen && (
          <section
            id={id}
            ref={panel}
            className="view-sheet-page"
            aria-label={
              panelLabel ?? (typeof label === "string" ? label : ariaLabel)
            }
          >
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                sheet.select(null);
                requestAnimationFrame(() => trigger.current?.focus());
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to view
            </Button>
            <div className="view-popover-content">{children}</div>
          </section>
        )}
      </>
    );
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
          if (e.newState === "closed") onClose?.();
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
