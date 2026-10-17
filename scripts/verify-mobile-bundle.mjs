import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "apps/mobile/dist");
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      ),
    )
  ).flat();
}
const artifacts = (await files(output)).filter((file) =>
  /\.(map|hbc|js)$/.test(file),
);
const maps = artifacts.filter((file) => file.endsWith(".map"));
if (maps.length !== 2)
  throw new Error(
    "Expected iOS and Android source maps for boundary validation.",
  );
for (const map of maps) {
  const { sources } = JSON.parse(await readFile(map, "utf8"));
  if (
    !Array.isArray(sources) ||
    sources.some((source) =>
      /(?:packages\/(?:db|domain)\/|apps\/web\/|@neondatabase\/|@neon\/realtime)/.test(
        source.replaceAll("\\", "/"),
      ),
    )
  )
    throw new Error("A native bundle contains a server-only module.");
}
// Compare values in memory only. Never print the selected keys or values.
const secrets = new Set();
for (const file of [".env.local", ".env.production.local"]) {
  try {
    const env = parse(await readFile(path.join(root, file)));
    for (const [key, value] of Object.entries(env))
      if (
        /(?:SECRET|TOKEN|PASSWORD|DATABASE_URL|DATABASE_URL_UNPOOLED|PRIVATE_KEY)/.test(
          key,
        ) &&
        value.length >= 12
      )
        secrets.add(value);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
for (const artifact of artifacts) {
  const contents = await readFile(artifact);
  for (const value of secrets)
    if (contents.includes(Buffer.from(value)))
      throw new Error(
        "A native bundle contains a selected local secret value.",
      );
}
console.log(
  "Verified both native bundle graphs: no server modules or selected local secret values.",
);
