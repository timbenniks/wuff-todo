import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "apps/web/public/prototype-kit");
await mkdir(output, { recursive: true });
await writeFile(
  resolve(output, "feature-brief.md"),
  await readFile(resolve(root, "docs/prototyping/feature-brief-template.md")),
);
const pages = [];
const paletteSource = await readFile(
  resolve(root, "packages/design/src/index.ts"),
  "utf8",
);
const paletteModule = ts.transpileModule(paletteSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { listPalette } = await import(
  `data:text/javascript;base64,${Buffer.from(paletteModule).toString("base64")}`
);
const paletteTable =
  "| Palette | Primary accent | Reference tint |\n| --- | --- | --- |\n" +
  Object.values(listPalette)
    .map((p) => `| ${p.label} | ${p.accent} | ${p.tint} |`)
    .join("\n");
for (const slug of [
  "overview",
  "product",
  "design",
  "components",
  "accessibility",
  "prototyping",
  "handoff",
  "build",
]) {
  let markdown = (
    await readFile(resolve(root, `docs/prototyping/${slug}.md`), "utf8")
  ).replace("<!-- PALETTE_TABLE -->", paletteTable);
  if (slug === "build") {
    markdown +=
      "\n\n" +
      (
        await readFile(resolve(root, "docs/contributor-workflow.md"), "utf8")
      ).replace(/^#/gm, "##");
  }
  pages.push({
    slug,
    title: markdown.split("\n")[0].replace(/^# /, ""),
    markdown,
  });
}
await writeFile(
  resolve(root, "apps/web/src/app/docs/content.generated.json"),
  JSON.stringify(pages, null, 2) + "\n",
);
const entries = new Map();
async function addTree(source, target) {
  for (const item of (await readdir(source, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (item.name === "node_modules" || item.name.startsWith(".")) continue;
    const from = resolve(source, item.name),
      to = `${target}/${item.name}`;
    if (item.isDirectory()) await addTree(from, to);
    else if (item.isFile() && !item.name.endsWith(".tsbuildinfo"))
      entries.set(to, await readFile(from));
  }
}
await addTree(resolve(root, "tools/prototype-kit"), "wuff-prototype");
entries.set(
  "wuff-prototype/src/App.tsx",
  await readFile(resolve(root, "apps/web/src/app/docs/prototype-demo.tsx")),
);
for (const name of ["ui", "design", "contracts", "client"]) {
  await addTree(
    resolve(root, `packages/${name}/src`),
    `wuff-prototype/packages/${name}/src`,
  );
  for (const file of ["package.json", "tsconfig.json"]) {
    entries.set(
      `wuff-prototype/packages/${name}/${file}`,
      await readFile(resolve(root, `packages/${name}/${file}`)),
    );
  }
}
// Match direct external dependency versions to the actual app installation.
// The original workspace package manifests above remain byte-for-byte copies.
const overrides = {};
for (const base of [
  "packages/ui",
  "packages/design",
  "packages/contracts",
  "packages/client",
  "apps/native",
]) {
  const require = createRequire(resolve(root, base, "package.json"));
  const pkg = JSON.parse(
    await readFile(resolve(root, base, "package.json"), "utf8"),
  );
  for (const dependency of Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  })) {
    if (
      dependency.startsWith("@wuff/") ||
      dependency.startsWith("@tauri-apps/")
    )
      continue;
    let entry;
    try {
      entry = require.resolve(`${dependency}/package.json`);
    } catch {
      entry = require.resolve(dependency);
    }
    let directory = dirname(entry);
    while (directory !== dirname(directory)) {
      try {
        const installed = JSON.parse(
          await readFile(resolve(directory, "package.json"), "utf8"),
        );
        if (installed.name === dependency) {
          overrides[dependency] = installed.version;
          break;
        }
      } catch {
        /* Some module entry directories have no package.json. */
      }
      directory = dirname(directory);
    }
  }
}
const starterPackage = JSON.parse(
  entries.get("wuff-prototype/package.json").toString(),
);
starterPackage.pnpm = { overrides };
entries.set(
  "wuff-prototype/package.json",
  Buffer.from(JSON.stringify(starterPackage, null, 2) + "\n"),
);
entries.set(
  "wuff-prototype/tsconfig.base.json",
  await readFile(resolve(root, "tsconfig.base.json")),
);
for (const file of ["dm-sans.ttf", "dm-sans-italic.ttf", "OFL.txt"]) {
  entries.set(
    `wuff-prototype/public/fonts/${file}`,
    await readFile(resolve(root, `apps/web/src/fonts/${file}`)),
  );
}
entries.set(
  "wuff-prototype/public/mascot/waffles-icon.webp",
  await readFile(resolve(root, "apps/web/public/mascot/waffles-icon.webp")),
);

const catalog = [];
for (const [path, bytes] of entries) {
  if (
    !path.startsWith("wuff-prototype/packages/ui/src/") ||
    !path.endsWith(".tsx")
  )
    continue;
  const code = bytes.toString(),
    file = ts.createSourceFile(
      path,
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const names = new Set();
  for (const node of file.statements) {
    if (
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      node.name
    )
      names.add(node.name.text);
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      node.exportClause.elements.forEach((e) =>
        names.add(e.propertyName?.text ?? e.name.text),
      );
    }
  }
  const components = file.statements.filter(
    (n) =>
      ts.isFunctionDeclaration(n) &&
      n.name &&
      /^[A-Z]/.test(n.name.text) &&
      names.has(n.name.text),
  );
  if (!components.length) continue;
  const local = path.replace("wuff-prototype/packages/ui/src/", "");
  catalog.push({
    source: `packages/ui/src/${local}`,
    module: `@wuff/ui/${local.startsWith("features/") ? local : local.replace(/\.tsx$/, "")}`,
    components: components.map((n) => ({
      name: n.name.text,
      signature: code.slice(n.getStart(file), n.body.pos).trim(),
    })),
  });
}
catalog.sort((a, b) => a.source.localeCompare(b.source));
await writeFile(
  resolve(root, "apps/web/src/app/docs/catalog.generated.json"),
  JSON.stringify(catalog, null, 2) + "\n",
);
await writeFile(
  resolve(output, "components.json"),
  JSON.stringify(catalog, null, 2) + "\n",
);
let sourceCommit = process.env.VERCEL_GIT_COMMIT_SHA || null;
if (!sourceCommit) {
  try {
    sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    /* CLI upload builds may not contain Git metadata; file hashes remain authoritative. */
  }
}
const manifest = {
  schema: 1,
  sourceCommit,
  note: "Hashes describe the exact build inputs, including any uncommitted source changes. Only client UI, design, contracts and client packages are included.",
  files: Object.fromEntries(
    [...entries].map(([path, bytes]) => [
      path.replace("wuff-prototype/", ""),
      createHash("sha256").update(bytes).digest("hex"),
    ]),
  ),
};
entries.set(
  "wuff-prototype/source-manifest.json",
  Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
);
await writeFile(
  resolve(output, "source-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

// A small deterministic ZIP writer (stored entries). No platform zip binary or
// downloaded archiver is needed during a Vercel build.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++)
    n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function zip(files) {
  const chunks = [],
    directory = [];
  let offset = 0;
  for (const [path, bytes] of files) {
    const name = Buffer.from(path);
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    chunks.push(header, name, bytes);
    directory.push(central, name);
    offset += header.length + name.length + bytes.length;
  }
  const size = directory.reduce((n, b) => n + b.length, 0),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...directory, end]);
}
await writeFile(resolve(output, "wuff-prototype.zip"), zip(entries));
const skillEntries = new Map();
async function skillTree(source, prefix) {
  for (const item of await readdir(source, { withFileTypes: true })) {
    const path = resolve(source, item.name),
      key = `${prefix}/${item.name}`;
    if (item.isDirectory()) await skillTree(path, key);
    else skillEntries.set(key, await readFile(path));
  }
}
await skillTree(resolve(root, "docs/prototyping/skill"), "wuff-prototype");
await writeFile(resolve(output, "wuff-prototype-skill.zip"), zip(skillEntries));
const contributorSkill = await readFile(
  resolve(root, ".agents/skills/wuff-contributor/SKILL.md"),
);
await writeFile(resolve(output, "CONTRIBUTOR-SKILL.md"), contributorSkill);
await writeFile(
  resolve(output, "wuff-contributor-skill.zip"),
  zip(new Map([["wuff-contributor/SKILL.md", contributorSkill]])),
);
await writeFile(
  resolve(output, "contributor-workflow.md"),
  await readFile(resolve(root, "docs/contributor-workflow.md")),
);
await writeFile(
  resolve(output, "contributor-pr-template.md"),
  await readFile(resolve(root, ".github/pull_request_template.md")),
);
await writeFile(
  resolve(output, "SKILL.md"),
  await readFile(resolve(root, "docs/prototyping/skill/SKILL.md")),
);
console.log(
  `Prototype kit: ${entries.size} files; ${catalog.reduce((n, m) => n + m.components.length, 0)} React components indexed. No server packages or environment files included.`,
);
