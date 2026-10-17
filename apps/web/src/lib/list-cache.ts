import type { TodoList } from "@wuff/contracts";

// One mounted user's in-memory cache. Nothing persists across sign-out/reload.
export class ListCache {
  private entries = new Map<string, TodoList>();
  private revisions = new Map<string, number>();
  private epoch = 0;
  private requests = new Map<
    string,
    { generation: string; promise: Promise<TodoList | null> }
  >();
  constructor(initial?: TodoList | null) {
    if (initial) this.entries.set(initial.id, initial);
  }
  get(id: string) {
    return this.entries.get(id) ?? null;
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
    this.entries.set(next.id, merged);
    return merged;
  }
  write(next: TodoList) {
    this.supersede(next.id);
    return this.accept(next);
  }
  supersede(id: string) {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
  }
  forget(id: string) {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
    this.entries.delete(id);
  }
  clear() {
    this.epoch++;
    this.entries.clear();
    this.revisions.clear();
    this.requests.clear();
  }
  load(id: string, fetcher: () => Promise<TodoList>): Promise<TodoList | null> {
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
      });
    this.requests.set(id, { generation, promise });
    return promise;
  }
}
