"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@wuff/ui/input";
import { Button } from "@wuff/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { displayISO, parseDisplayDate } from "@wuff/contracts/totake/dateFormat";
import { dayDate, epoch, fullDate, isoDay, monthGrid, monthLabel, monthShift, monthStart } from "@wuff/contracts/totake/calendar";
export function DateInput({
  id,
  value,
  draftText,
  onChange,
}: {
  id: string;
  value: string;
  draftText?: string;
  onChange: (iso: string, text: string) => void;
}) {
  const [text, setText] = useState(() => draftText ?? displayISO(value));
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(0),
    [focused, setFocused] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    field = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null),
    outsideStart = useRef(false);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      outsideStart.current =
        !!root.current && !root.current.contains(e.target as Node);
    };
    const click = (e: MouseEvent) => {
      if (
        !outsideStart.current ||
        !root.current ||
        root.current.contains(e.target as Node)
      )
        return;
      const target = e.target as HTMLElement,
        interactive = target.closest(
          'button,input,select,textarea,a,[tabindex]:not([tabindex="-1"])',
        );
      requestAnimationFrame(() => {
        if (!root.current) return;
        setOpen(false);
        const top = [...document.querySelectorAll("dialog[open]")].at(-1);
        if (!interactive && (!top || top.contains(root.current)))
          (opener.current?.isConnected
            ? opener.current
            : field.current
          )?.focus();
      });
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("click", click);
    };
  }, [open]);
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      setText(displayISO(value));
      emitted.current = value;
    }
  }, [value]);
  const change = (next: string) => {
    setText(next);
    const iso = parseDisplayDate(next);
    emitted.current = iso;
    onChange(iso, next);
  };
  const focusDay = (day: number) => {
    setMonth(monthStart(day));
    setFocused(day);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-picker-day="${day}"]`)
        ?.focus(),
    );
  };
  const show = (focus = false) => {
    opener.current = document.activeElement as HTMLElement;
    const iso = parseDisplayDate(text) || value;
    const day = iso
      ? Math.round((Date.parse(iso + "T00:00:00Z") - epoch) / 86400000)
      : 0;
    setMonth(monthStart(day));
    setFocused(day);
    setOpen(true);
    if (focus)
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLButtonElement>(`[data-picker-day="${day}"]`)
          ?.focus(),
      );
  };
  const close = () => {
    setOpen(false);
    (opener.current?.isConnected ? opener.current : field.current)?.focus();
  };
  const select = (day: number) => {
    change(displayISO(isoDay(day)));
    close();
  };
  const keyDay = (event: KeyboardEvent<HTMLButtonElement>, day: number) => {
    const weekday = (dayDate(day).getUTCDay() + 6) % 7;
    const delta = (
      {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7,
        Home: -weekday,
        End: 6 - weekday,
      } as Record<string, number>
    )[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      focusDay(day + delta);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const first = monthShift(day, event.key === "PageUp" ? -1 : 1),
        last = monthShift(first, 1) - 1;
      focusDay(Math.min(first + dayDate(day).getUTCDate() - 1, last));
    }
  };
  return (
    <div
      className="date-picker"
      ref={root}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="date-picker-entry">
        <Input
          ref={field}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD-MM-YYYY"
          title="DD-MM-YYYY"
          aria-invalid={(!!text && !parseDisplayDate(text)) || undefined}
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          maxLength={10}
          value={text}
          onClick={() => show()}
          onKeyDown={(e) => {
            if (["ArrowDown", "Enter", "F4"].includes(e.key)) {
              e.preventDefault();
              show(true);
            }
          }}
          onChange={(e) => change(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Choose date"
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          onClick={() => (open ? close() : show(true))}
        >
          <CalendarDays size={18} />
        </Button>
      </div>
      {open && (
        <section
          id={`${id}-calendar`}
          className="date-picker-panel"
          aria-label="Date picker"
        >
          <div className="month-controls">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => {
                const next = monthShift(month, -1);
                setMonth(next);
                setFocused(next);
              }}
            >
              <ChevronLeft size={18} />
            </Button>
            <h4 aria-live="polite">{monthLabel(month)}</h4>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => {
                const next = monthShift(month, 1);
                setMonth(next);
                setFocused(next);
              }}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          <div className="month-weekdays" aria-hidden="true">
            {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div
            className="date-picker-grid"
            role="group"
            aria-label={monthLabel(month)}
          >
            {monthGrid(month).map((day) => (
              <Button
                type="button"
                variant="ghost"
                key={day}
                data-picker-day={day}
                tabIndex={day === focused ? 0 : -1}
                aria-label={fullDate(day)}
                aria-pressed={parseDisplayDate(text) === isoDay(day)}
                data-outside={
                  dayDate(day).getUTCMonth() !== dayDate(month).getUTCMonth()
                }
                onFocus={() => setFocused(day)}
                onKeyDown={(e) => keyDay(e, day)}
                onClick={() => select(day)}
              >
                {dayDate(day).getUTCDate()}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
