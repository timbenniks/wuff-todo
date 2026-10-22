import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@wuff/contracts",
    "@wuff/db",
    "@wuff/domain",
    "@wuff/ui",
  ],
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/mcp": ["./.mcp/ui.html"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
