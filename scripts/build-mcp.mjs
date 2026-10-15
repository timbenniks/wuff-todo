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
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:15px system-ui;color:#263e55;background:#f7fafc;margin:0;padding:20px}h1{font-size:24px;letter-spacing:-.03em;margin:0 0 20px}button,input{font:inherit}button{cursor:pointer;border:1px solid #dce5ed;border-radius:10px;padding:10px 14px;background:#315f9b;color:white}button:disabled{opacity:.5}.list{display:block;width:100%;text-align:left;background:white;color:#263e55;margin:8px 0}.task{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #dce5ed}.task input{width:20px;height:20px}form{display:flex;gap:8px;margin-top:20px}form input{min-width:0;flex:1;border:1px solid #dce5ed;border-radius:10px;padding:10px}#status{font-size:13px;color:#536c82;margin-top:16px}button:focus-visible,input:focus-visible{outline:2px solid #315f9b;outline-offset:3px}</style></head><body><header style="display:flex;align-items:center;gap:10px;margin-bottom:20px;font-weight:700"><img src="data:image/webp;base64,${mascot}" width="48" height="48" alt="Waffles the corgi">Wuff Todo</header><main id="app"><h1>Wuff Todo</h1><p>Fetching your list…</p></main><p id="status" role="status"></p><script type="module">${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
await mkdir("apps/web/.mcp", { recursive: true });
await writeFile("apps/web/.mcp/ui.html", html);
console.log("MCP App bundled.");
