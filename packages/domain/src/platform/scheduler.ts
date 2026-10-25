import { createHash } from "node:crypto";
export function reminderSchedulerReady() {
  return !!(
    process.env.QSTASH_TOKEN &&
    process.env.QSTASH_CURRENT_SIGNING_KEY &&
    process.env.QSTASH_NEXT_SIGNING_KEY &&
    process.env.WUFF_ORIGIN?.startsWith("https://")
  );
}

/** QStash rejects colons. Hash an unambiguous tuple into a bounded ASCII ID.
 * Keep the wake minute: identical retries deduplicate while later hops/generations
 * and product namespaces remain separate. This does not imply exactly-once delivery.
 */
export function schedulerDeduplicationId(
  product: "todo" | "totake",
  jobId: string,
  version: number,
  wakeAt: number,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([product, jobId, version, Math.floor(wakeAt / 60000)]),
    )
    .digest("hex");
}
