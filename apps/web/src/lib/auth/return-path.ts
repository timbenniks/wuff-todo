// Accept only local routes that we explicitly support after sign-in.
export function signInReturnPath(value?: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/";
  if (
    [
      "/",
      "/lists",
      "/totake",
      "/notes",
      "/settings/notes",
      "/settings",
      "/settings/reminders",
      "/settings/connections",
      "/settings/docs",
      "/settings/apps",
      "/settings/dashboard",
      "/settings/notifications",
      "/settings/account",
      "/settings/todo",
      "/settings/todo/github",
      "/settings/todo/cursor",
      "/settings/totake",
    ].includes(value)
  )
    return value;
  if (
    value === "/lists?home=1" ||
    /^\/lists\?listId=[a-f0-9-]{36}$/i.test(value)
  )
    return value;
  if (
    /^\/notes\?note=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    ) ||
    /^\/notes\?filter=(?:all|pinned|shared|archived|trash)$/.test(value)
  )
    return value;
  if (/^\/tasks\/(?:[a-f0-9-]{36}|WUFF-[1-9][0-9]{0,9})$/i.test(value))
    return value;
  return value.startsWith("/oauth/authorize?") ? value : "/";
}
