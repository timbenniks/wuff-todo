"use client";
import { useEffect, useState } from "react";
import { calendarDay } from "./due-date";
export function useCalendarDay() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setToday(calendarDay());
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
