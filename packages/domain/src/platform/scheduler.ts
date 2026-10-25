export function reminderSchedulerReady() {
  return !!(
    process.env.QSTASH_TOKEN &&
    process.env.QSTASH_CURRENT_SIGNING_KEY &&
    process.env.QSTASH_NEXT_SIGNING_KEY &&
    process.env.WUFF_ORIGIN?.startsWith("https://")
  );
}
