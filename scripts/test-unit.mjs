import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
export async function discoverUnitTests(directory) {
  const found = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (
        entry.isFile() &&
        /\.test\.(?:[cm]?[jt]s|tsx)$/.test(entry.name) &&
        !/\.integration\.test\./.test(entry.name)
      )
        found.push(next);
    }
  }
  await walk(directory);
  return found.sort();
}

async function run() {
  const files = await discoverUnitTests(resolve(root, "tests"));
  if (!files.length)
    throw new Error(
      "No unit tests found; refusing an empty successful test run.",
    );
  console.log(
    `Running ${files.length} discovered unit test files (integration suites excluded).`,
  );
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--test", ...files.map((file) => relative(root, file))],
    { cwd: root, stdio: "inherit" },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
