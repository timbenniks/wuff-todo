"use client";
import { useEffect } from "react";
import type { ListColor } from "@wuff/contracts";
import { applyListTheme } from "@/lib/list-theme";

// The selected, authorized list is the source of truth. No task data or offline
// state is stored. Document scope also colors native dialogs and the page gutter.
export function ListTheme({ color }: { color: ListColor }) {
  useEffect(() => {
    applyListTheme(color, document.documentElement);
    return () => applyListTheme("blue", document.documentElement);
  }, [color]);
  return null;
}
