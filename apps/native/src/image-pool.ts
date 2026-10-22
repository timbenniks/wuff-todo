// Mounted images only: at most 16 x 3 MiB, shared by id, never persisted.
export class ImagePool {
  private entries = new Map<
    string,
    { refs: number; url?: string; promise: Promise<string> }
  >();
  private stopped = false;
  constructor(
    private fetchImage: (id: string) => Promise<Blob>,
    private urls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
  ) {}
  async acquire(id: string) {
    if (this.stopped) throw new Error("Image session ended.");
    let entry = this.entries.get(id);
    if (!entry) {
      if (this.entries.size >= 16)
        throw new Error("Close other notes before loading more images.");
      entry = { refs: 0, promise: Promise.resolve("") };
      const current = entry;
      this.entries.set(id, current);
      current.promise = this.fetchImage(id)
        .then((blob) => {
          if (blob.size > 3 * 1024 * 1024 || blob.type !== "image/webp")
            throw new Error("This image could not be opened.");
          if (this.stopped || current.refs === 0)
            throw new Error("Image session ended.");
          current.url = this.urls.createObjectURL(blob);
          return current.url;
        })
        .catch((error) => {
          if (this.entries.get(id) === current) this.entries.delete(id);
          throw error;
        });
    }
    entry.refs++;
    const current = entry;
    const release = () => {
      current.refs = Math.max(0, current.refs - 1);
      if (current.refs === 0 && current.url) {
        this.urls.revokeObjectURL(current.url);
        current.url = undefined;
        if (this.entries.get(id) === current) this.entries.delete(id);
      }
    };
    try {
      return { url: await current.promise, release };
    } catch (error) {
      release();
      throw error;
    }
  }
  clear() {
    this.stopped = true;
    for (const entry of this.entries.values())
      if (entry.url) this.urls.revokeObjectURL(entry.url);
    this.entries.clear();
  }
}

// plugin-http exposes response headers as an override. Response.blob() can use
// the empty internal headers instead, so validate and assign the MIME explicitly.
export async function privateImageBlob(response: Response) {
  if (!response.ok)
    throw new Error("This image could not be loaded. Reopen notes to retry.");
  const type = response.headers.get("content-type")?.split(";")[0].trim();
  const length = Number(response.headers.get("content-length"));
  if (type !== "image/webp" || length > 3 * 1024 * 1024)
    throw new Error("This image could not be opened.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 3 * 1024 * 1024)
    throw new Error("This image is too large.");
  return new Blob([bytes], { type });
}
