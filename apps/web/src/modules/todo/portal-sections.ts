import type { Dashboard } from "@wuff/contracts";
// The portal follows existing Todo visibility/order without writing preferences.
export function portalSections(dashboard: Dashboard) {
  const { sections, hidden } = dashboard.preferences.settings;
  return sections.filter((section) => !hidden.includes(section));
}
