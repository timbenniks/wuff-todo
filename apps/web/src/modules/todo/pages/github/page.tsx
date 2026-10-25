import { redirect } from "next/navigation";
export default async function GithubPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.listId) query.set("listId", params.listId);
  if (params.error) query.set("error", params.error);
  redirect("/settings/todo/github" + (query.size ? "?" + query : ""));
}
