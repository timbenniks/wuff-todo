import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Fail the build if server implementation accidentally enters the client graph.
function clientBoundary(): Plugin {
  return {
    name: "wuff-client-boundary",
    enforce: "pre",
    resolveId(source) {
      if (
        /^(@wuff\/(db|domain)(\/|$)|server-only$|next(\/|$)|node:)/.test(source)
      ) {
        this.error(`Server-only import in the native frontend: ${source}`);
      }
      return null;
    },
    transform(_code, id) {
      if (/\/packages\/(db|domain)\//.test(id.replaceAll("\\", "/"))) {
        this.error("Server implementation entered the native frontend.");
      }
      return null;
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [clientBoundary(), react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: { target: ["es2022", "safari16"], sourcemap: false },
});
