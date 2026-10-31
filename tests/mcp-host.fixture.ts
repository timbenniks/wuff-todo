import {
  AppBridge,
  PostMessageTransport,
} from "../apps/web/node_modules/@modelcontextprotocol/ext-apps/dist/src/app-bridge.js";

const iframe = document.querySelector<HTMLIFrameElement>("iframe")!;
const bridge = new AppBridge(
  null,
  { name: "Wuff local test host", version: "1.0" },
  { serverTools: {}, logging: {} },
);
bridge.oncalltool = async (params) => {
  const response = await fetch("/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return response.json();
};
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult(await (await fetch("/bootstrap")).json());
};
await bridge.connect(
  new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!),
);
iframe.srcdoc = await (await fetch("/app-html")).text();

// Read-only host tool-result delivery for cross-product rendering regressions.
Object.assign(window, {
  wuffFixtureShowTool: async (name: string, args: Record<string, unknown>) => {
    const response = await fetch("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
    });
    const result = await response.json();
    if (result.isError) throw Error("Synthetic host tool result failed");
    await bridge.sendToolResult(result);
  },
});
