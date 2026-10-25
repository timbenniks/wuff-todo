
import { createHash } from "node:crypto";
import { put, get, del, head, BlobNotFoundError } from "@vercel/blob";
import sharp from "sharp";
import { AppError, taskImageLimit } from "@wuff/contracts";

export function imageStorageConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}
function credentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token)
    throw new AppError(
      "images_unavailable",
      "Image uploads aren’t available yet. Your notes are safe.",
      503,
    );
  return { token };
}
export function decodeTaskImage(value: string) {
  if (
    !value ||
    value.length > 4 * Math.ceil(taskImageLimit / 3) ||
    value.length % 4 ||
    /[^A-Za-z0-9+/=]/.test(value)
  )
    throw new AppError(
      "invalid_image",
      "Use a base64-encoded PNG, JPEG or WebP image up to 3 MiB.",
    );
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value)
    throw new AppError(
      "invalid_image",
      "Use standard base64 without a data URL prefix.",
    );
  return bytes;
}
export async function normalizeTaskImage(input: Uint8Array) {
  if (!input.byteLength || input.byteLength > taskImageLimit)
    throw new AppError(
      "image_too_large",
      "That’s a big pup! Choose an image up to 3 MiB.",
      413,
    );
  try {
    const image = sharp(input, {
      limitInputPixels: 40_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error("Unsupported image");
    // Re-encode instead of trusting names/MIME; strips EXIF and executable payloads.
    const { data, info } = await image
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > taskImageLimit) throw new Error("Output too large");
    return {
      data,
      width: info.width,
      height: info.height,
      bytes: data.length,
      digest: createHash("sha256").update(data).digest("hex"),
    };
  } catch {
    throw new AppError(
      "invalid_image",
      "Ruff image! Choose a still PNG, JPEG or WebP image up to 3 MiB.",
    );
  }
}
export async function storeTaskImage(pathname: string, data: Uint8Array) {
  const options = credentials();
  // An operation retry uses the same immutable, digest-bound pathname.
  try {
    const existing = await head(pathname, options);
    if (existing.size !== data.byteLength)
      throw new Error("Image size mismatch");
    return;
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) throw error;
  }
  try {
    await put(pathname, Buffer.from(data), {
      ...options,
      access: "private",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
    });
  } catch (error) {
    // A concurrent identical retry may have uploaded first. Never overwrite it.
    const existing = await head(pathname, options).catch(() => null);
    if (!existing || existing.size !== data.byteLength) throw error;
  }
}
export async function loadTaskImage(pathname: string) {
  const result = await get(pathname, { ...credentials(), access: "private" });
  if (!result || result.statusCode !== 200)
    throw new AppError("not_found", "Image not found.", 404);
  return result.stream;
}
export async function eraseTaskImage(pathname: string) {
  await del(pathname, credentials());
}
