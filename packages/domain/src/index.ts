// Public compatibility surface. Adapters may also import explicit product subpaths.
export { requireScope } from "./platform/access";
export * from "./platform/empire";
export * from "./modules/todo";
export * from "./modules/todo/github";
export * from "./modules/todo/agents";
export * from "./modules/todo/reminders";
export {
  getTotake,
  updateTotake,
  getTotakeSummary,
} from "./modules/totake/totake";
export {
  recoverTotakeScheduling,
  schedulePendingTotake,
  deliverTotake,
  totakeDeliveryStatus,
} from "./modules/totake/delivery";
export * from "./platform/notification-settings";
export * from "./platform/mcp-tools";

export { scheduleModuleNotifications } from "./platform/module-services";

export * from "./modules/notes";
