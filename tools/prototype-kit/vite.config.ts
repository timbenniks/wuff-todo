import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "client-only-prototype",
      enforce: "pre",
      resolveId(source) {
        if (
          /^(@wuff\/(db|domain)(\/|$)|server-only$|next(\/|$)|node:)/.test(
            source,
          )
        )
          this.error(
            `Server import is outside this client-only prototype: ${source}`,
          );
      },
    },
  ],
  build: { target: ["es2022", "safari16"] },
});
