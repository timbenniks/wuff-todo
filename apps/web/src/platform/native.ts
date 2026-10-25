import * as domain from "@wuff/domain";
import type { Actor } from "@wuff/contracts";
export const platformNativeOperations = {
  getMcpToolPreferences: domain.getMcpToolPreferences,
  updateMcpToolPreferences: domain.updateMcpToolPreferences,
  getAiConnections: domain.getAiConnections,
  disconnectAiClient: domain.disconnectAiClient,
  getNotificationSettings: domain.getNotificationSettings,
  updateNotificationSettings: domain.updateNotificationSettings,
  getEmpireSettings: domain.getEmpireSettings,
  updateEmpireSettings: domain.updateEmpireSettings,
  session: (actor: Actor) => ({ userId: actor.id, scopes: actor.scopes }),
};
