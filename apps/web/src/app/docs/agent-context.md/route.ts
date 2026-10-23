import pages from "../content.generated.json";
import catalog from "../catalog.generated.json";
export const dynamic = "force-static";
export function GET() {
  const text = [
    "# Wuff Todo prototype reference",
    "Living guide: https://wuff-todo.vercel.app/docs",
    "Starter: https://wuff-todo.vercel.app/prototype-kit/wuff-prototype.zip",
    "Skill: https://wuff-todo.vercel.app/prototype-kit/SKILL.md",
    "Exact source hashes: https://wuff-todo.vercel.app/prototype-kit/source-manifest.json",
    ...pages.map((p) => p.markdown),
    "# Exact exported component signatures",
    ...catalog.map(
      (item) =>
        `## ${item.module}\nSource: ${item.source}\n\n${item.components.map((c) => `\`\`\`tsx\n${c.signature}\n\`\`\``).join("\n\n")}`,
    ),
  ].join("\n\n");
  return new Response(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
