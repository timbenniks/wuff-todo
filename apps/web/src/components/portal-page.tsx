import { redirect } from "next/navigation";
import { AppError, type empireModules } from "@wuff/contracts";
import { pageActor } from "@/lib/auth/server";
import { ActorApiProvider } from "@/platform/actor-api";

export async function PortalPage({
  destination,
  children,
}: {
  destination: "/" | "/settings" | (typeof empireModules)[number]["href"];
  children: React.ReactNode;
}) {
  try {
    const actor = await pageActor();
    return (
      <ActorApiProvider key={actor.id} userId={actor.id}>
        {children}
      </ActorApiProvider>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401)
      redirect(`/sign-in?next=${encodeURIComponent(destination)}`);
    if (error instanceof AppError && [403, 429, 503].includes(error.status))
      return (
        <main className="empire-page">
          <h1>
            {error.status === 403
              ? "An invite to the pack is needed."
              : "Paws a moment."}
          </h1>
          <p>
            {error.status === 403
              ? "This account needs an active Wuff invitation. Ask the person who invited you to finish setting up your access."
              : "We couldn’t check your session. Try again shortly."}
          </p>
          <a className="empire-text-link" href={destination}>
            Try again
          </a>
        </main>
      );
    throw error;
  }
}
