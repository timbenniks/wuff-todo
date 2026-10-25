export function notificationDeliveryPolicy(
  preferences:
    | { paused: boolean; todo: boolean; totake: boolean; showContent: boolean }
    | undefined,
  app: "todo" | "totake",
) {
  return {
    paused: !!preferences && (preferences.paused || preferences[app]),
    showContent: preferences?.showContent ?? app === "todo",
  };
}
