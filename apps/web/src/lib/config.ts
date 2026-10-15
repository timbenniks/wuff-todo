export function appOrigin() {
  const configured = process.env.WUFF_ORIGIN;
  if (configured) return new URL(configured).origin;
  if (process.env.VERCEL_ENV === "production")
    return "https://wuff-todo.vercel.app";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
export const mcpResource = () => `${appOrigin()}/api/mcp`;
