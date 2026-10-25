import type { EmpireModule } from "../../module-types";
export const todoModule = {
  permissions: [
    { scope: "lists:read", label: "Todo: read accessible lists and tasks" },
    {
      scope: "tasks:write",
      label: "Todo: change tasks and personal reminders",
    },
    {
      scope: "lists:manage",
      label: "Todo: manage owned lists and personal views",
    },
    {
      scope: "github:manage",
      label: "Todo: manage GitHub connections and linked issues",
    },
    {
      scope: "agents:manage",
      label: "Todo: manage coding environments and paid agents",
    },
  ],
  id: "todo",
  name: "Wuff Todo",
  href: "/lists",
  settingsHref: "/settings/todo",
  description: "Private lists, shared plans, and a little less to remember.",
  routes: ["/lists", "/tasks", "/github", "/agents", "/connections"],
  defaults: {
    visible: true,
    dashboard: true,
  },
  settings: [
    ["/settings/todo", "Overview"],
    ["/settings/reminders", "Reminders"],
    ["/settings/todo/github", "GitHub"],
    ["/settings/todo/cursor", "Cursor"],
  ],
  mcpGroups: [
    {
      id: "todo",
      title: "Wuff Todo",
      order: 10,
    },
    {
      id: "github",
      title: "GitHub",
      order: 50,
    },
    {
      id: "agents",
      title: "Coding agents",
      order: 60,
    },
  ],
  status: "available",
  hasDashboard: true,
  dashboard: [
    {
      id: "todo.summary",
    },
  ],
  theme: "blue",
} as const satisfies Omit<EmpireModule, "mcpTools">;
