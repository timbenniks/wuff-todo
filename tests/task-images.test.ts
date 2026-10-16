import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { taskImageLimit, taskImageId, taskImagePath } from "@wuff/contracts";
import {
  normalizeTaskImage,
  decodeTaskImage,
} from "../packages/domain/src/image-storage";
import { taskImageReferences } from "../packages/domain/src/task-images";
import {
  renderTaskMarkdown,
  needsPreservedNote,
} from "../apps/web/src/lib/task-markdown";
import { boundedBody } from "../apps/web/src/lib/bounded-body";
const sharp = createRequire(
  new URL("../packages/domain/package.json", import.meta.url),
)("sharp");
test("private images are resized and re-encoded without original metadata; forged types are rejected", async () => {
  const input = await sharp({
    create: { width: 4096, height: 1024, channels: 3, background: "#d5e6ef" },
  })
    .withMetadata({ exif: { IFD0: { Artist: "Synthetic fixture" } } })
    .jpeg()
    .toBuffer();
  const normalized = await normalizeTaskImage(input);
  const metadata = await sharp(normalized.data).metadata();
  assert.equal(normalized.width, 2048);
  assert.equal(normalized.height, 512);
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(normalized.digest.length, 64);
  for (const data of [
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ),
    Buffer.from("not an image"),
  ])
    await assert.rejects(normalizeTaskImage(data), { code: "invalid_image" });
  await assert.rejects(normalizeTaskImage(new Uint8Array(taskImageLimit + 1)), {
    code: "image_too_large",
  });
  assert.throws(() => decodeTaskImage("data:image/png;base64,AAAA"), {
    code: "invalid_image",
  });
  assert.throws(() => decodeTaskImage("AAAA!"), { code: "invalid_image" });
  assert.equal(
    decodeTaskImage(Buffer.alloc(taskImageLimit).toString("base64")).length,
    taskImageLimit,
  );
});
test("only canonical attachment references render images, with escaped descriptions and MCP placeholders", () => {
  const id = crypto.randomUUID(),
    path = taskImagePath(id),
    content = `![Pack & photo](${path})`;
  assert.equal(taskImageId(path), id);
  assert.equal(taskImageId(`${path}?other=1`), null);
  assert.equal(taskImageId(`https://tracker.invalid${path}`), null);
  assert.match(renderTaskMarkdown(content), new RegExp(`src="${path}"`));
  assert.match(renderTaskMarkdown(content), /alt="Pack &amp; photo"/);
  assert.equal(needsPreservedNote(content), false);
  const host = renderTaskMarkdown(content, { imageSource: () => null });
  assert.match(host, /data-task-image=/);
  assert.doesNotMatch(host, /<img|src=/);
  for (const content of [
    `![External](https://tracker.invalid/x.png)`,
    `<img src="${path}" onerror="alert(1)">`,
    `![bad](${path}/../other)`,
    `![bad](${path}?token=x)`,
  ])
    assert.doesNotMatch(renderTaskMarkdown(content), /<img/);
  assert.deepEqual(
    taskImageReferences(
      `${content}\n\n${content}\n\n\`\`\`md\n![code](${taskImagePath(crypto.randomUUID())})\n\`\`\``,
    ),
    [id],
  );
});
test("upload body limits apply to streamed requests without a content length", async () => {
  const request = new Request("https://wuff.test/upload", {
    method: "POST",
    body: new Blob([new Uint8Array(11)]),
  });
  await assert.rejects(boundedBody(request, 10), { code: "too_large" });
  assert.equal(
    (
      await boundedBody(
        new Request("https://wuff.test/upload", {
          method: "POST",
          body: new Uint8Array(10),
        }),
        10,
      )
    ).length,
    10,
  );
});
