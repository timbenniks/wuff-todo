import { after } from "next/server";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { idSchema, AppError } from "@wuff/contracts";
import * as agents from "@wuff/domain";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const actor = await webActor(),
      p = new URL(request.url).searchParams;
    if (p.has("activity")) {
      const cursor = p.get("cursor") ?? undefined;
      if (cursor && (cursor.length > 2048 || /[\r\n]/.test(cursor)))
        throw new AppError("invalid_cursor", "Invalid activity cursor.", 400);
      return privateJson(
        await agents.agentActivity(
          actor,
          idSchema.parse(p.get("taskId")),
          idSchema.parse(p.get("activity")),
          cursor,
        ),
      );
    }
    if (p.has("taskId")) {
      const result = await agents.agentTask(
        actor,
        idSchema.parse(p.get("taskId")),
      );
      after(() => agents.processAgentJobs());
      return privateJson(result);
    }
    if (p.has("environments"))
      return privateJson(
        await agents.cursorEnvironments(actor, idSchema.parse(p.get("listId"))),
      );
    if (p.has("listId"))
      return privateJson(
        await agents.cursorReadiness(actor, idSchema.parse(p.get("listId"))),
      );
    return privateJson(await agents.cursorConnection(actor));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(),
      { action, ...input } = await jsonInput(request, 32768);
    if (action === "connect") {
      if (typeof input.apiKey !== "string")
        throw new AppError("invalid_key", "Enter a Cursor API key.", 400);
      return privateJson(await agents.cursorConnect(actor, input.apiKey));
    }
    if (action === "secret") {
      if (typeof input.name !== "string" || typeof input.value !== "string")
        throw new AppError(
          "invalid_secret",
          "Enter a secret name and value.",
          400,
        );
      return privateJson(
        await agents.setCursorSecret(
          actor,
          idSchema.parse(input.listId),
          input.name,
          input.value,
        ),
      );
    }
    const actions = {
      bind: agents.bindCursorEnvironment,
      createEnvironment: agents.createCursorEnvironment,
      launch: agents.launchAgent,
      message: agents.messageAgent,
      cancel: agents.cancelAgent,
      recover: agents.recoverAgentRun,
    };
    if (typeof action !== "string" || !Object.hasOwn(actions, action))
      throw new AppError("invalid_action", "Unknown agent action.", 400);
    const result = await actions[action as keyof typeof actions](actor, input);
    after(() => agents.processAgentJobs());
    return privateJson(result);
  } catch (e) {
    return failure(e);
  }
}
