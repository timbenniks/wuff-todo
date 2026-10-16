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
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:15px system-ui;color:#263e55;background:#f7fafc;margin:0;padding:20px}h1{font-size:24px;letter-spacing:-.03em;margin:0 0 20px}button,input,textarea,select{font:inherit}button{cursor:pointer;border:1px solid #dce5ed;border-radius:10px;padding:10px 14px;background:#315f9b;color:white}button:disabled{opacity:.5}.list{display:block;width:100%;text-align:left;background:white;color:#263e55;margin:8px 0}.task{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #dce5ed}.task input{width:20px;height:20px}form{display:flex;gap:8px;margin-top:20px}form input{min-width:0;flex:1;border:1px solid #dce5ed;border-radius:10px;padding:10px}#status{font-size:13px;color:#536c82;margin-top:16px}button:focus-visible,input:focus-visible{outline:2px solid #315f9b;outline-offset:3px}.list-header{margin:20px 0;padding:18px;border-radius:14px;border-left:5px solid}.list-header h1{margin:0 0 10px}.list-header p{overflow-wrap:anywhere}.settings{display:grid;margin:12px 0}.settings textarea,.settings select,select{max-width:100%;padding:8px;border:1px solid #dce5ed;border-radius:8px;background:white}.section{margin-top:24px}summary{cursor:pointer;padding:8px 0;font-weight:600}.section-actions{display:grid;gap:8px;margin-top:12px}.catalog-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0}.catalog-row .list{flex:1;min-width:120px}.catalog-row>button:not(.list){font-size:12px;padding:6px}.task{flex-wrap:wrap}.task span{flex:1;min-width:100px;overflow-wrap:anywhere}textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid #315f9b;outline-offset:3px}.inline-name{flex:1;min-width:0}.name-button{display:inline-flex;align-items:flex-start;gap:8px;max-width:100%;padding:4px 0;border:0;background:transparent;color:inherit;text-align:left;font:inherit}.name-button span:first-child{min-width:0;overflow-wrap:anywhere}.name-button .name-mark{flex:0;min-width:0;color:#6b8294;font-size:13px}.name-editor{display:grid;gap:8px;width:100%;margin:0}.name-editor label{font-size:12px;color:#536c82}.name-editor input{width:100%;box-sizing:border-box}.name-editor p{margin:0;font-size:13px;color:#9f3434}.name-actions{display:flex;gap:8px;flex-wrap:wrap}.name-button:focus-visible{outline:2px solid #315f9b;outline-offset:3px}</style></head><body><header style="display:flex;align-items:center;gap:10px;margin-bottom:20px;font-weight:700"><img src="data:image/webp;base64,${mascot}" width="48" height="48" alt="Waffles the corgi">Wuff Todo</header><main id="app"><h1>Wuff Todo</h1><p>Fetching your list…</p></main><p id="status" role="status"></p><script type="module">${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
await mkdir("apps/web/.mcp", { recursive: true });
await writeFile("apps/web/.mcp/ui.html", html);
console.log("MCP App bundled.");
