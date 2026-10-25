import type { TodoList } from "@wuff/contracts";

// One mounted user's in-memory cache. Nothing persists across sign-out/reload.
export class ListCache {
  private entries = new Map<string, TodoList>();
  private revisions = new Map<string, number>();
  private epoch = 0;
  private serial = 0;
  private requests = new Map<
    string,
    { generation: string; promise: Promise<TodoList | null> }
  >();
  constructor(
    initial?: TodoList | null,
    private limit = 20,
  ) {
    if (initial) this.entries.set(initial.id, initial);
  }
  get(id: string) {
    const value = this.entries.get(id);
    if (value) {
      this.entries.delete(id);
      this.entries.set(id, value);
    }
    return value ?? null;
  }
  private generation(id: string) {
    return `${this.epoch}:${this.revisions.get(id) ?? 0}`;
  }
  private accept(next: TodoList) {
    const previous = this.get(next.id);
    const current =
      previous && previous.version > next.version ? previous : next;
    // Task and personal-view revisions advance independently. A concurrent task
    // response must not restore an older view (or vice versa).
    const personalView =
      (previous?.personalView?.version ?? 0) > (next.personalView?.version ?? 0)
        ? previous?.personalView
        : next.personalView;
    const merged = personalView ? { ...current, personalView } : current;
    this.entries.delete(next.id);
    this.entries.set(next.id, merged);
    while (this.entries.size > this.limit)
      this.forget(this.entries.keys().next().value!);
    return merged;
  }
  write(next: TodoList) {
    this.supersede(next.id);
    return this.accept(next);
  }
  supersede(id: string) {
    this.revisions.set(id, ++this.serial);
  }
  forget(id: string) {
    this.revisions.set(id, ++this.serial);
    this.entries.delete(id);
    if (!this.requests.has(id)) this.revisions.delete(id);
  }
  clear() {
    this.epoch++;
    this.entries.clear();
    this.revisions.clear();
    this.requests.clear();
  }
  load(id: string, fetcher: () => Promise<TodoList>): Promise<TodoList | null> {
    if (!this.revisions.has(id)) this.revisions.set(id, ++this.serial);
    const generation = this.generation(id);
    const existing = this.requests.get(id);
    if (existing?.generation === generation) return existing.promise;
    const promise = fetcher()
      .then((next) => {
        if (this.generation(id) !== generation) return this.get(id);
        return this.accept(next);
      })
      .finally(() => {
        if (this.requests.get(id)?.promise === promise)
          this.requests.delete(id);
        if (!this.entries.has(id) && !this.requests.has(id))
          this.revisions.delete(id);
      });
    this.requests.set(id, { generation, promise });
    return promise;
  }
}
