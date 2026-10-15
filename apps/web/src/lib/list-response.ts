import type { Actor } from "@wuff/contracts";
import { webActor } from "./auth/server";
import { privateJson } from "./http";

// Durations only: no identities, list names, SQL, or credentials in diagnostics.
export async function listResponse(
  operation: (actor: Actor) => Promise<unknown>,
) {
  const started = performance.now();
  const actor = await webActor();
  const authorized = performance.now();
  const result = await operation(actor);
  const response = privateJson(result);
  response.headers.set(
    "Server-Timing",
    `auth;dur=${(authorized - started).toFixed(1)}, domain;dur=${(performance.now() - authorized).toFixed(1)}`,
  );
  response.headers.set("X-Wuff-Region", process.env.VERCEL_REGION ?? "local");
  return response;
}
