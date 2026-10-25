// Generate once per environment. Never print or silently rotate push credentials.
import { createECDH } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function writeWebPushEnvironment(output, subject) {
  const contact = new URL(subject);
  if (
    !["mailto:", "https:"].includes(contact.protocol) ||
    contact.username ||
    contact.password ||
    (contact.protocol === "mailto:" && !contact.pathname.includes("@"))
  )
    throw Error(
      "Use a mailto contact or public HTTPS website as the VAPID subject.",
    );
  const key = createECDH("prime256v1");
  key.generateKeys();
  const contents = `WEB_PUSH_PUBLIC_KEY=${key.getPublicKey().toString("base64url")}\nWEB_PUSH_PRIVATE_KEY=${key.getPrivateKey().toString("base64url")}\nWEB_PUSH_SUBJECT=${contact.href}\n`;
  writeFileSync(output, contents, { flag: "wx", mode: 0o600 });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [output, subject] = process.argv.slice(2);
    if (!output || !subject || !/^\.env\.[a-z0-9.-]+\.local$/.test(output))
      throw Error(
        "Usage: node scripts/setup-web-push.mjs .env.web-push.local https://your-public-site",
      );
    writeWebPushEnvironment(output, subject);
    console.log(
      "Web push keys saved privately. Existing files are never overwritten. Keep these keys stable and out of Git.",
    );
  } catch (error) {
    console.error(
      error?.code === "EEXIST"
        ? "Key file already exists; nothing changed. Reuse existing keys."
        : "Could not create web push key file. Check the filename/contact and file permissions.",
    );
    process.exitCode = 1;
  }
}
