import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError, type GithubSyncFields } from "@wuff/contracts";
export function verifyGithubSignature(
  body: string,
  signature: string,
  secret: string,
) {
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  );
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function githubSafeFields(value: GithubSyncFields): GithubSyncFields {
  if (
    !value.title.trim() ||
    value.title.length > 300 ||
    value.body.length > 16000 ||
    /(?:\/api\/v1\/attachments\/|attachment:|blob:|data:|<\/?[a-z][^>]*>)/i.test(
      value.body,
    )
  )
    throw new AppError(
      "github_unsupported_content",
      "Use notes without private attachments or HTML before enabling GitHub sync.",
      409,
    );
  return {
    ...value,
    title: value.title.trim(),
    body: value.body.replace(/\r\n/g, "\n"),
  };
}
export function mergeGithub(
  base: GithubSyncFields,
  local: GithubSyncFields,
  remote: GithubSyncFields,
) {
  const merged = { ...local };
  let conflict = false;
  for (const key of ["title", "body", "closed"] as const) {
    if (local[key] === base[key]) Object.assign(merged, { [key]: remote[key] });
    else if (remote[key] !== base[key] && local[key] !== remote[key])
      conflict = true;
  }
  return { merged, conflict };
}

export function sameGithubFields(a: GithubSyncFields, b: GithubSyncFields) {
  return a.title === b.title && a.body === b.body && a.closed === b.closed;
}
