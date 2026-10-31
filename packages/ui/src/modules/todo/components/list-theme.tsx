"use client";
import { useEffect } from "react";
import type { ListColor } from "@wuff/contracts";
import { applyListTheme } from "../lib/list-theme";

// The selected, authorized list is the source of truth. No task data or offline
// state is stored. Document scope also colors native dialogs and the page gutter.
export function ListTheme({ color }: { color: ListColor }) {
  useEffect(() => {
    const update = () => applyListTheme(color, document.documentElement, true);
    const query = matchMedia("(prefers-color-scheme: dark)");
    update();
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      applyListTheme("blue", document.documentElement);
    };
  }, [color]);
  return null;
}
