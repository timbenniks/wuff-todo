import type { EmpireModule } from "../../module-types";
export const totakeModule = {
  permissions: [
    {
      scope: "totake:read",
      label: "Totake: read private medication, equipment, history and stock",
    },
    {
      scope: "totake:write",
      label: "Totake: change schedules, records, reminders and stock",
    },
  ],
  id: "totake",
  name: "Wuff Totake",
  href: "/totake",
  settingsHref: "/settings/totake",
  description: "A personal home for medicine reminders.",
  routes: ["/totake"],
  defaults: {
    visible: true,
    dashboard: false,
  },
  settings: [["/settings/totake", "Reminders"]],
  mcpGroups: [
    {
      id: "totake",
      title: "Wuff Totake",
      order: 20,
    },
  ],
  status: "available",
  hasDashboard: true,
  dashboard: [
    {
      id: "totake.summary",
    },
  ],
  theme: "blue",
} as const satisfies Omit<EmpireModule, "mcpTools">;
