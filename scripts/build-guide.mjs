import { readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "apps/web/public/contributor-kit");
// Both locations contain generated downloads only. Remove retired/stale outputs.
await rm(resolve(root, "apps/web/public/prototype-kit"), {
  recursive: true,
  force: true,
});
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
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
const pages = [];
for (const slug of [
  "overview",
  "product",
  "modules",
  "design",
  "components",
  "accessibility",
  "surfaces",
  "build",
  "review",
]) {
  let markdown = (
    await readFile(resolve(root, `docs/guide/${slug}.md`), "utf8")
  ).replace("<!-- PALETTE_TABLE -->", paletteTable);
  if (slug === "build")
    markdown +=
      "\n\n" +
      (
        await readFile(resolve(root, "docs/contributor-workflow.md"), "utf8")
      ).replace(/^#/gm, "##");
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

// Inspect current repository source directly; no copied standalone app or dependencies.
const catalog = [];
async function scan(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!item.isFile() || !path.endsWith(".tsx")) continue;
    const code = await readFile(path, "utf8");
    const file = ts.createSourceFile(
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
      )
        node.exportClause.elements.forEach((e) =>
          names.add(e.propertyName?.text ?? e.name.text),
        );
    }
    const components = file.statements.filter(
      (n) =>
        ts.isFunctionDeclaration(n) &&
        n.name &&
        n.body &&
        /^[A-Z]/.test(n.name.text) &&
        names.has(n.name.text),
    );
    if (!components.length) continue;
    const local = relative(resolve(root, "packages/ui/src"), path).replaceAll(
      "\\",
      "/",
    );
    catalog.push({
      source: `packages/ui/src/${local}`,
      module: `@wuff/ui/${local.startsWith("features/") ? local : local.replace(/\.tsx$/, "")}`,
      components: components.map((n) => ({
        name: n.name.text,
        signature: code.slice(n.getStart(file), n.body.pos).trim(),
      })),
    });
  }
}
await scan(resolve(root, "packages/ui/src"));
catalog.sort((a, b) => a.source.localeCompare(b.source));
await writeFile(
  resolve(root, "apps/web/src/app/docs/catalog.generated.json"),
  JSON.stringify(catalog, null, 2) + "\n",
);
const downloads = new Map();
for (const [name, source] of [
  ["SKILL.md", ".agents/skills/wuff-contributor/SKILL.md"],
  ["contributor-workflow.md", "docs/contributor-workflow.md"],
  ["contributor-pr-template.md", ".github/pull_request_template.md"],
  ["feature-brief.md", "docs/guide/feature-brief-template.md"],
])
  downloads.set(name, await readFile(resolve(root, source)));
downloads.set(
  "components.json",
  Buffer.from(JSON.stringify(catalog, null, 2) + "\n"),
);
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
downloads.set(
  "wuff-contributor-skill.zip",
  zip(new Map([["wuff-contributor/SKILL.md", downloads.get("SKILL.md")]])),
);
for (const [name, bytes] of downloads)
  await writeFile(resolve(output, name), bytes);
await writeFile(
  resolve(output, "source-manifest.json"),
  JSON.stringify(
    {
      schema: 1,
      note: "SHA-256 hashes of these exact contributor downloads. Read implementation source from the repository checkout.",
      files: Object.fromEntries(
        [...downloads].map(([name, bytes]) => [
          name,
          createHash("sha256").update(bytes).digest("hex"),
        ]),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Implementation guide: ${pages.length} pages; ${catalog.reduce((n, m) => n + m.components.length, 0)} React components indexed; contributor downloads only.`,
);
