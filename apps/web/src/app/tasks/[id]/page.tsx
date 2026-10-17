import { redirect, notFound } from "next/navigation";
import { getTask } from "@wuff/domain";
import { AppError, taskLookupSchema } from "@wuff/contracts";
import { pageActor, webIdentity } from "@/lib/auth/server";
import { sealLiveLists } from "@/lib/live-server";
import { ActorApiProvider } from "../../lists/actor-api";
import { TaskDetailApp } from "./task-detail-app";

export const dynamic = "force-dynamic";
export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!taskLookupSchema.safeParse(id).success) notFound();
  try {
    if (!(await webIdentity()))
      redirect(`/sign-in?next=${encodeURIComponent(`/tasks/${id}`)}`);
    const actor = await pageActor();
    const detail = await getTask(actor, id);
    return (
      <ActorApiProvider userId={actor.id}>
        <TaskDetailApp
          initial={detail}
          userId={actor.id}
          liveConfig={await sealLiveLists(actor)}
        />
      </ActorApiProvider>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    if (error instanceof AppError && error.status === 403)
      return (
        <main className="max-w-md mx-auto px-6 py-16">
          <h1 className="text-3xl font-bold">An invitation is needed.</h1>
          <p className="mt-4">
            Your account needs an active Wuff invitation before opening tasks.
          </p>
        </main>
      );
    if (error instanceof AppError && [429, 503].includes(error.status))
      return (
        <main className="max-w-md mx-auto px-6 py-16">
          <h1 className="text-3xl font-bold">Paws a moment.</h1>
          <p className="mt-4">
            We couldn’t check your session. Reload to try again.
          </p>
        </main>
      );
    throw error;
  }
}
