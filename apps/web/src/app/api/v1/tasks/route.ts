import { after } from "next/server";
import { processGithubJobs } from "@wuff/domain";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { createTask, deleteTask, reorderTasks, updateTask } from "@wuff/domain";
async function mutate(request: Request, action: typeof createTask) {
  try {
    sameOrigin(request);
    const result = await action(
      await webActor(),
      await jsonInput(request, 131_072),
    );
    after(() => processGithubJobs());
    return privateJson(result);
  } catch (error) {
    return failure(error);
  }
}
export const POST = (r: Request) => mutate(r, createTask);
export const PATCH = (r: Request) => mutate(r, updateTask);
export const DELETE = (r: Request) => mutate(r, deleteTask);
export const PUT = (r: Request) => mutate(r, reorderTasks);
