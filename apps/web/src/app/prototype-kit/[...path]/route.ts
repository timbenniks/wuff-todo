export function GET() {
  return new Response(
    "The standalone Wuff prototype kit and prototype skill are retired. Use /docs for the implementation guide and /contributor-kit/SKILL.md for the contributor skill. Build and iterate independently in an authorized repository workspace; Tim reviews before merge.\n",
    {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
