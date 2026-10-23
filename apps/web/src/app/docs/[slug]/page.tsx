import { notFound } from "next/navigation";
import pages from "../content.generated.json";
import { Article } from "../article";
export function generateStaticParams() {
  return pages
    .filter((page) => page.slug !== "overview")
    .map((page) => ({ slug: page.slug }));
}
export default async function GuideArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!pages.some((page) => page.slug === slug) || slug === "overview")
    notFound();
  return <Article slug={slug} />;
}
