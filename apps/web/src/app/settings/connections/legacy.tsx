"use client";
import { useEffect } from "react";
export function LegacyConnections() {
  useEffect(() => {
    if (
      window.location.hash === "#cursor" ||
      new URLSearchParams(window.location.search).has("listId")
    )
      window.location.replace(
        "/settings/todo/cursor" + window.location.search + window.location.hash,
      );
  }, []);
  return null;
}
