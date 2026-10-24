import pages from "../content.generated.json";
import catalog from "../catalog.generated.json";
export const dynamic = "force-static";
export function GET() {
  const text = [
    "# Wuff Todo implementation reference",
    "Read root/nearby AGENTS.md and docs/contributor-workflow.md in the current repository checkout first. Hosted content may lag unmerged changes.",
    "Living guide: https://wuff-todo.vercel.app/docs",
    "Skill: https://wuff-todo.vercel.app/contributor-kit/SKILL.md",
    "Download hashes: https://wuff-todo.vercel.app/contributor-kit/source-manifest.json",
    "Component inventory: https://wuff-todo.vercel.app/contributor-kit/components.json. Read actual implementation source from the checkout.",
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
