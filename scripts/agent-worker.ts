// Run on an always-on worker using the same environment as the Wuff deployment.
// Provider requests are bounded; durable rows/leases recover process interruption.
import { processAgentJobs } from "@wuff/domain";
import { database } from "@wuff/db";
if (process.env.CURSOR_EXECUTION_ENABLED !== "true")
  throw Error("Agent execution is disabled.");
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
try {
  while (!stopped) {
    try {
      await processAgentJobs(4);
    } catch {
      console.error("Agent worker cycle failed; retrying.");
    }
    if (!stopped) await new Promise((resolve) => setTimeout(resolve, 15000));
  }
} finally {
  await database().pool.end();
}
