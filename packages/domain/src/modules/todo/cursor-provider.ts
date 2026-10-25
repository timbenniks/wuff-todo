import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { AppError } from "@wuff/contracts";

function encryptionKey() {
  const key = process.env.CURSOR_TOKEN_SECRET;
  if (!key || key.length < 32)
    throw new AppError(
      "cursor_unconfigured",
      "Cursor credential encryption is not configured.",
      503,
    );
  return createHash("sha256").update(key).digest();
}
export function sealCursorKey(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function openCursorKey(value: string) {
  const bytes = Buffer.from(value, "base64url"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      bytes.subarray(0, 12),
    );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export class CursorError extends AppError {
  constructor(public providerStatus: number) {
    super(
      providerStatus === 401
        ? "cursor_invalid_key"
        : providerStatus === 403
          ? "cursor_access_denied"
          : providerStatus === 429
            ? "cursor_rate_limited"
            : "cursor_unavailable",
      providerStatus === 401
        ? "Cursor rejected this API key (HTTP 401). Copy a user API key from Cursor Dashboard → API Keys. Use the Cursor key, not Wuff’s encryption secret."
        : providerStatus === 403
          ? "Cursor denied access (HTTP 403). Check this key’s permissions and account access."
          : providerStatus === 429
            ? "Cursor is rate limiting requests (HTTP 429). Wait a moment and retry."
            : `Cursor returned HTTP ${providerStatus}. Please retry; if it persists, contact the administrator.`,
      providerStatus === 401
        ? 400
        : providerStatus === 403
          ? 403
          : providerStatus === 429
            ? 503
            : 502,
    );
  }
}
export async function cursorRequest(
  key: string,
  path: string,
  init: RequestInit = {},
) {
  // Fixed origin; provider responses and error bodies never become logs.
  const r = await fetch(`https://api.cursor.com/v1${path}`, {
    ...init,
    redirect: "error",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new CursorError(r.status);
  return r;
}
export async function cursorJson(key: string, path: string, body?: unknown) {
  const r = await cursorRequest(
    key,
    path,
    body === undefined ? {} : { method: "POST", body: JSON.stringify(body) },
  );
  return r.status === 204 ? {} : r.json();
}
export const terminalRun = (s: string) =>
  ["FINISHED", "ERROR", "CANCELLED", "EXPIRED"].includes(s);
export function environmentMatches(environment: any, repository: string) {
  return (
    typeof environment?.name === "string" &&
    environment.name.length > 0 &&
    Array.isArray(environment.repos) &&
    environment.repos.length === 1 &&
    environment.repos[0].url?.replace(/\.git\/?$/, "").replace(/\/$/, "") ===
      `https://github.com/${repository}`
  );
}
export function publicAgentEvent(event: string, data: any) {
  // Tool arguments/results can contain credentials. Expose only progress metadata.
  if (event === "tool_call")
    return {
      type: event,
      name: String(data.name ?? "").slice(0, 200),
      status: String(data.status ?? "").slice(0, 100),
    };
  if (["assistant", "thinking"].includes(event))
    return { type: event, text: String(data.text ?? "").slice(0, 16000) };
  if (event === "status")
    return { type: event, status: String(data.status ?? "").slice(0, 100) };
  return null;
}
export function agentPullRequestUrls(git: any, repository: string): string[] {
  const urls = new Set<string>();
  for (const branch of Array.isArray(git?.branches) ? git.branches : []) {
    if (
      branch.repoUrl !== `github.com/${repository}` ||
      typeof branch.prUrl !== "string"
    )
      continue;
    try {
      const url = new URL(branch.prUrl);
      if (
        url.origin === "https://github.com" &&
        !url.username &&
        !url.password &&
        url.pathname.startsWith(`/${repository}/pull/`) &&
        /^[1-9][0-9]*$/.test(url.pathname.slice(`/${repository}/pull/`.length))
      )
        urls.add(`${url.origin}${url.pathname}`);
    } catch {}
  }
  return [...urls].slice(0, 20);
}
