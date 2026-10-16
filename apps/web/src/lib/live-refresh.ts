// Coalesce a stream of changes and defer refreshes while a local write is in
// flight. A change arriving during a read must trigger one more fresh read.
export class LiveRefreshQueue {
  private dirty = false;
  private running = false;
  private stopped = false;
  constructor(
    private refresh: () => Promise<void>,
    private blocked: () => boolean,
  ) {}
  notify() {
    this.dirty = true;
    return this.flush();
  }
  async flush() {
    if (this.stopped || this.running || this.blocked()) return;
    this.running = true;
    try {
      while (this.dirty && !this.stopped && !this.blocked()) {
        this.dirty = false;
        try {
          await this.refresh();
        } catch {
          /* Polling/focus refresh retries failures. */
        }
      }
    } finally {
      this.running = false;
    }
  }
  stop() {
    this.stopped = true;
    this.dirty = false;
  }
}
