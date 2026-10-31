import type { DashboardSection, DashboardSettings } from "@wuff/contracts";
export function todoDayPanels(sections: DashboardSection[]) {
  return sections.filter(
    (id): id is "today" | "upcoming" => id !== "favorites",
  );
}
export function moveTodoDayPanel(
  sections: DashboardSection[],
  section: DashboardSection,
  delta: number,
) {
  const visible = todoDayPanels(sections),
    index = visible.indexOf(section as "today" | "upcoming"),
    destination = index + delta;
  if (index < 0 || destination < 0 || destination >= visible.length)
    return [...sections];
  [visible[index], visible[destination]] = [
    visible[destination],
    visible[index],
  ];
  let at = 0;
  return sections.map((id) => (id === "favorites" ? id : visible[at++]));
}
export function resetTodoDayPanels(
  settings: DashboardSettings,
): DashboardSettings {
  let at = 0;
  const defaults: DashboardSection[] = ["today", "upcoming"];
  return {
    ...settings,
    startPage: "home",
    hidden: settings.hidden.filter((id) => id === "favorites"),
    sections: settings.sections.map((id) =>
      id === "favorites" ? id : defaults[at++],
    ),
  };
}
