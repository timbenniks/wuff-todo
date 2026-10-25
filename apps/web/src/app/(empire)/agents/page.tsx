import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { listId } = await searchParams;
  redirect(
    `/connections${listId ? `?listId=${encodeURIComponent(listId)}` : ""}#cursor`,
  );
}
