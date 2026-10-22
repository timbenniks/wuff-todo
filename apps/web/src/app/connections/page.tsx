import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { listId } = await searchParams;
  redirect(
    `/settings/connections${listId ? `?listId=${encodeURIComponent(listId)}` : ""}`,
  );
}
