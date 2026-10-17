import { after } from "next/server";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { appOrigin } from "@/lib/config";
import { idSchema } from "@wuff/contracts";
import * as github from "@wuff/domain";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const actor = await webActor(),
      p = new URL(request.url).searchParams;
    if (p.has("taskId"))
      return privateJson(
        await github.githubTask(actor, idSchema.parse(p.get("taskId"))),
      );
    if (p.has("pullRequests"))
      return privateJson(
        await github.githubPullRequests(
          actor,
          idSchema.parse(p.get("pullRequests")),
        ),
      );
    if (p.has("listId"))
      return privateJson(
        await github.githubList(actor, idSchema.parse(p.get("listId"))),
      );
    if (p.has("repositories"))
      return privateJson(await github.githubRepositories(actor));
    return privateJson(await github.githubConnections(actor));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(),
      { action, ...input } = await jsonInput(request, 32768);
    if (action === "connect")
      return privateJson(await github.githubStart(actor, appOrigin()));
    const actions = {
      bind: github.githubBind,
      disconnect: github.githubUnbind,
      link: github.githubLink,
      unlink: github.githubUnlink,
      retry: github.githubRetry,
      resolve: github.githubResolve,
    };
    if (typeof action !== "string" || !Object.hasOwn(actions, action))
      return Response.json(
        {
          error: { code: "invalid_action", message: "Unknown GitHub action." },
        },
        { status: 400 },
      );
    const result = await actions[action as keyof typeof actions](actor, input);
    after(() => github.processGithubJobs());
    return privateJson(result);
  } catch (e) {
    return failure(e);
  }
}
