// Deterministic exports of the approved Waffles artwork; run from repo root.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", {
    paths: [require.resolve("next", { paths: ["./apps/web"] })],
  }),
);
const source = "apps/web/public/mascot/waffles-icon.png";
const out = "apps/web/public/icons";
await mkdir(out, { recursive: true });
const bg = "#e7f0f8";
async function tile(size, ratio = 0.86, transparent = false) {
  const edge = Math.round(size * ratio);
  const character = await sharp(source).resize(edge, edge).png().toBuffer();
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent ? "#00000000" : bg,
    },
  }).composite([{ input: character, gravity: "centre" }]);
  return (transparent ? canvas : canvas.removeAlpha()).png().toBuffer();
}
await sharp(source)
  .resize(256, 256)
  .webp({ quality: 90 })
  .toFile("apps/web/public/mascot/waffles-icon.webp");
for (const size of [16, 32, 48])
  await writeFile(`${out}/favicon-${size}.png`, await tile(size, 1, true));
// PNG entries inside an ICO container, supported by modern browsers.
const sizes = [16, 32, 48];
const buffers = await Promise.all(sizes.map((s) => tile(s, 1, true)));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const pos = 6 + i * 16;
  header[pos] = sizes[i];
  header[pos + 1] = sizes[i];
  header.writeUInt16LE(1, pos + 4);
  header.writeUInt16LE(32, pos + 6);
  header.writeUInt32LE(buffers[i].length, pos + 8);
  header.writeUInt32LE(offset, pos + 12);
  offset += buffers[i].length;
}
await writeFile(
  "apps/web/src/app/favicon.ico",
  Buffer.concat([header, ...buffers]),
);
for (const size of [180, 192, 512, 1024])
  await writeFile(`${out}/app-${size}.png`, await tile(size));
await writeFile(`${out}/maskable-512.png`, await tile(512, 0.64));
await writeFile(
  `${out}/android-foreground-432.png`,
  await tile(432, 0.64, true),
);
const portrait = await sharp(source).resize(490, 490).png().toBuffer();
const text = Buffer.from(
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><g fill="#263e55" font-family="Trebuchet MS, sans-serif"><text x="565" y="280" font-size="78" font-weight="bold">Wuff Todo</text><text x="570" y="348" font-size="30">A little less to remember.</text><text x="570" y="395" font-size="25">Lists for you and your people.</text></g></svg>`,
);
await sharp({
  create: { width: 1200, height: 630, channels: 3, background: bg },
})
  .composite([{ input: portrait, left: 40, top: 70 }, { input: text }])
  .png()
  .toFile(`${out}/share.png`);
console.log("Waffles web, social and future native exports generated.");
