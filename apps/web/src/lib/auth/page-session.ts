import {
  createAuthServer,
  extractNeonAuthCookies,
  resolveNeonAuthLogging,
} from "@neondatabase/auth/server";

// Server Components can read cookies but cannot persist upstream Set-Cookie.
// Disable renewal here; Route Handlers retain the normal writable SDK adapter.
export function pageSession(
  config: { baseUrl: string; cookieSecret: string },
  requestHeaders: Headers,
) {
  const auth = createAuthServer({
    ...config,
    log: resolveNeonAuthLogging({ logLevel: "silent" }),
    context: () => ({
      getCookies: () => extractNeonAuthCookies(requestHeaders),
      // Upstream may still clear an invalid cookie. Rendering must stay read-only.
      setCookie: () => {},
      getHeader: (name) => requestHeaders.get(name),
      getOrigin: () =>
        requestHeaders.get("origin") ||
        requestHeaders.get("referer")?.split("/").slice(0, 3).join("/") ||
        "",
      getFramework: () => "nextjs",
    }),
  });
  return auth.getSession({
    query: { disableCookieCache: "true", disableRefresh: "true" },
  });
}
