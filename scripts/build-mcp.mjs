import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const result = await build({
  entryPoints: ["apps/web/src/mcp-app/main.ts"],
  bundle: true,
  minify: true,
  write: false,
  format: "esm",
  target: "es2022",
});
const mascot = (
  await readFile("apps/web/public/mascot/waffles-icon.webp")
).toString("base64");
const prose = await readFile(
  "packages/ui/src/modules/todo/task-prose.css",
  "utf8",
);
const design = await readFile("packages/ui/src/design-system.css", "utf8");
const mcpStyle = await readFile("apps/web/src/mcp-app/styles.css", "utf8");
// Embed the same licensed font files as the web app: no host/CDN access needed.
let fonts = "";
for (const [file, style] of [
  ["dm-sans.ttf", "normal"],
  ["dm-sans-italic.ttf", "italic"],
]) {
  const data = (await readFile(`apps/web/src/fonts/${file}`)).toString(
    "base64",
  );
  fonts += `@font-face{font-family:"DM Sans";font-style:${style};font-weight:100 1000;font-display:swap;src:url(data:font/ttf;base64,${data}) format("truetype");}`;
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fonts}${design}${mcpStyle}${prose}</style></head><body><header style="display:flex;align-items:center;gap:10px;margin-bottom:20px;font-weight:700"><img src="data:image/webp;base64,${mascot}" width="48" height="48" alt="Waffles the corgi">Wuff Empire</header><main id="app"><h1>Wuff Empire</h1><p>Fetching your workspace…</p></main><p id="status" role="status"></p><script type="module">${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
await mkdir("apps/web/.mcp", { recursive: true });
await writeFile("apps/web/.mcp/ui.html", html);
console.log("MCP App bundled.");
