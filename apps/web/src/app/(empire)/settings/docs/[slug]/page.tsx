import { notFound } from "next/navigation";
import pages from "@/app/docs/content.generated.json";
import { Article } from "@/app/docs/article";
export default async function SettingsGuideArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!pages.some((page) => page.slug === slug) || slug === "overview")
    notFound();
  return <Article slug={slug} />;
}
