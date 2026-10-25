"use client";
import { lazy, type ComponentType } from "react";
import { CheckCheck, Pill, type LucideIcon } from "lucide-react";
import type { empireModules } from "@wuff/contracts";
export type ModuleDashboardProps = { userId: string };
export type ModuleUi = {
  icon: LucideIcon;
  dashboard: Record<string, ComponentType<ModuleDashboardProps>>;
};
export const moduleUi = {
  todo: {
    icon: CheckCheck,
    dashboard: {
      "todo.summary": lazy(() =>
        import("./todo/dashboard").then((m) => ({
          default: m.TodoSummaryCard,
        })),
      ),
    },
  },
  totake: {
    icon: Pill,
    dashboard: {
      "totake.summary": lazy(() =>
        import("./totake/dashboard").then((m) => ({
          default: m.TotakeSummaryCard,
        })),
      ),
    },
  },
} satisfies {
  [M in (typeof empireModules)[number] as M["id"]]: Omit<
    ModuleUi,
    "dashboard"
  > & {
    dashboard: Record<
      M["dashboard"][number]["id"],
      ComponentType<ModuleDashboardProps>
    >;
  };
};
