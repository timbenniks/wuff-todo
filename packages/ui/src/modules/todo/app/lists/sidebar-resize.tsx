"use client";
import { useLayoutEffect, useRef, useState } from "react";
import {
  clampSidebarWidth,
  defaultSidebarWidth,
  readSidebarWidth,
  saveSidebarWidth,
  sidebarWidthBounds,
} from "../../lib/sidebar-width";

export function useSidebarWidth(userId: string) {
  const [state, setState] = useState({ userId, width: defaultSidebarWidth });
  const [viewport, setViewport] = useState(1280);
  useLayoutEffect(() => {
    let width = defaultSidebarWidth;
    try {
      width = readSidebarWidth(window.localStorage, userId);
    } catch {}
    setState({ userId, width });
    const resize = () => setViewport(window.innerWidth);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [userId]);
  const width = clampSidebarWidth(
    state.userId === userId ? state.width : defaultSidebarWidth,
    viewport,
  );
  function setWidth(next: number | null, persist = true) {
    const value = clampSidebarWidth(
      next ?? defaultSidebarWidth,
      window.innerWidth,
    );
    setState({ userId, width: value });
    if (persist) {
      try {
        saveSidebarWidth(
          window.localStorage,
          userId,
          next === null ? null : value,
        );
      } catch {}
    }
  }
  return { width, setWidth, bounds: sidebarWidthBounds(viewport) };
}

export function SidebarResize({
  width,
  setWidth,
  bounds,
}: ReturnType<typeof useSidebarWidth>) {
  const drag = useRef<{ start: number; x: number } | null>(null);
  return (
    <div
      className="sidebar-resizer"
      role="separator"
      tabIndex={0}
      aria-label="Sidebar width"
      aria-orientation="vertical"
      aria-controls="todo-sidebar"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      onKeyDown={(event) => {
        const next =
          event.key === "ArrowLeft"
            ? width - 16
            : event.key === "ArrowRight"
              ? width + 16
              : event.key === "Home"
                ? bounds.min
                : event.key === "End"
                  ? bounds.max
                  : null;
        if (next !== null) {
          event.preventDefault();
          setWidth(next);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { start: width, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current)
          setWidth(drag.current.start + event.clientX - drag.current.x, false);
      }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        setWidth(drag.current.start + event.clientX - drag.current.x);
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        if (drag.current) setWidth(drag.current.start, false);
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        if (drag.current) setWidth(drag.current.start, false);
        drag.current = null;
      }}
    />
  );
}
