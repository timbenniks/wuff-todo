export const defaultSidebarWidth = 260;
export const sidebarWidthKey = (userId: string) =>
  `wuff:todo:sidebar-width:v1:${userId}`;
export function sidebarWidthBounds(viewport: number) {
  return { min: 260, max: Math.max(260, Math.min(440, viewport - 480)) };
}
export function clampSidebarWidth(width: number, viewport: number) {
  const { min, max } = sidebarWidthBounds(viewport);
  return Math.round(
    Math.max(
      min,
      Math.min(max, Number.isFinite(width) ? width : defaultSidebarWidth),
    ),
  );
}
type WidthStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readSidebarWidth(storage: WidthStorage, userId: string) {
  try {
    const raw = storage.getItem(sidebarWidthKey(userId));
    const value = raw && raw.trim() ? Number(raw) : NaN;
    return Number.isFinite(value) && value >= 260 && value <= 440
      ? value
      : defaultSidebarWidth;
  } catch {
    return defaultSidebarWidth;
  }
}
export function saveSidebarWidth(
  storage: WidthStorage,
  userId: string,
  width: number | null,
) {
  try {
    if (width === null) storage.removeItem(sidebarWidthKey(userId));
    else
      storage.setItem(
        sidebarWidthKey(userId),
        String(clampSidebarWidth(width, 1920)),
      );
  } catch {
    /* Device layout remains usable when storage is unavailable. */
  }
}
