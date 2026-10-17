import { redirect } from "next/navigation";
import { authorizationDetails } from "@/lib/oauth";
import { pageActor, webIdentity } from "@/lib/auth/server";
import { Corgi } from "@/components/corgi";
import { nativeClientId } from "@/lib/native-policy";
import { Consent } from "./consent";
export const dynamic = "force-dynamic";
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams,
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  let details;
  try {
    details = await authorizationDetails(params);
  } catch {
    return (
      <main className="max-w-md mx-auto px-6 py-24">
        <h1 className="text-3xl font-bold mb-4">
          Ruff request! This connection isn’t valid.
        </h1>
        <p>Head back to your AI pal and give this connection another sniff.</p>
      </main>
    );
  }
  if (!(await webIdentity()))
    redirect(
      `/sign-in?next=${encodeURIComponent(`/oauth/authorize?${params}`)}`,
    );
  try {
    await pageActor();
  } catch {
    return (
      <main className="max-w-md mx-auto p-8">
        Our pack is invite-only. Your account needs an invitation before
        connecting an AI client.
      </main>
    );
  }
  const native = details.client.id === nativeClientId;
  const labels: Record<string, string> = {
    "lists:read": "Read your accessible lists and tasks",
    "tasks:write": "Add, edit, complete, delete, and reorder tasks",
    "lists:manage": "Create lists and manage lists you own",
    "github:manage":
      "Connect GitHub repositories and create or synchronize linked issues",
  };
  return (
    <main className="max-w-md mx-auto px-6 py-20">
      <Corgi />
      <h1 className="text-3xl font-bold mt-8 mb-4">
        Connect {details.client.name}?
      </h1>
      <p className="text-muted-foreground">
        {native
          ? "Wuff on your phone is asking to:"
          : "This AI pal wants to join your pack. It is asking to:"}
      </p>
      <ul className="list-disc pl-5 my-6 space-y-3">
        {details.requested.map((s) => (
          <li key={s}>{labels[s]}</li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground mb-7">
        {native
          ? "Your phone can access the same lists you can. You can revoke its connection from the website’s Connected AI clients page."
          : "Your AI pal follows your lead: it can access the same lists you can. You can disconnect it at any time in Connected AI clients."}
      </p>
      <Consent query={params.toString()} />
    </main>
  );
}
