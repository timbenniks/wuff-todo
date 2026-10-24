export function GET() {
  return new Response(
    "The standalone Wuff prototype kit and prototype skill are retired. Use /docs for the implementation guide and /contributor-kit/SKILL.md for the contributor skill. Work requires an authorized repository workspace, approved scope and Tim's review.\n",
    {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
