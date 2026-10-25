import { empireModules } from "../modules";
import { z } from "zod";
export const idSchema = z.uuid();
export const operationSchema = z.object({ operationId: z.uuid() });
export const versionSchema = z.number().int().nonnegative();
export const scopes = [
  ...empireModules
    .flatMap<(typeof empireModules)[number]["permissions"][number]>(
      (module) => module.permissions,
    )
    .map((permission) => permission.scope),
  "notifications:read",
  "notifications:manage",
  "empire:read",
  "empire:manage",
] as const;
export type Scope = (typeof scopes)[number];
export type Actor = {
  id: string;
  scopes: readonly string[];
  /** Trusted OAuth client identity set by the MCP bearer adapter; never parsed from input. */
  mcpClientId?: string;
};

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}
