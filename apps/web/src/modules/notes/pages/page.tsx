import { PortalPage } from "@/components/portal-page";
import { pageActor } from "@/lib/auth/server";
import {
  searchNotes,
  getNote,
  getNotesSettings,
} from "@wuff/domain/modules/notes";
import { idSchema, noteQuerySchema, AppError } from "@wuff/contracts";
import { NotesApp } from "@wuff/ui/modules/notes/notes-app";
import "@wuff/ui/modules/notes/notes.css";
export const metadata = { title: "Wuff Notes · Wuff Empire" };
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; filter?: string }>;
}) {
  const query = await searchParams;
  return (
    <PortalPage destination="/notes">
      <Content query={query} />
    </PortalPage>
  );
}
async function Content({
  query,
}: {
  query: { note?: string; filter?: string };
}) {
  const actor = await pageActor();
  const filter =
    noteQuerySchema.shape.filter.safeParse(query.filter ?? "all").data ?? "all";
  try {
    if (query.note && !idSchema.safeParse(query.note).success)
      throw new AppError("not_found", "Note unavailable.", 404);
    const [initial, initialNote, settings] = await Promise.all([
      searchNotes(actor, { filter }),
      query.note
        ? getNote(actor, idSchema.parse(query.note))
        : Promise.resolve(null),
      getNotesSettings(actor),
    ]);
    return (
      <NotesApp
        key={actor.id + ":" + (query.note ?? filter)}
        userId={actor.id}
        initial={initial}
        initialNote={initialNote}
        initialFilter={filter}
        settings={settings}
      />
    );
  } catch (e) {
    if (e instanceof AppError && e.status === 404)
      return (
        <main id="empire-content" className="empire-page">
          <h1>Note unavailable</h1>
          <p>
            This note is private, was removed or is no longer shared with you.
          </p>
          <a href="/notes" className="empire-text-link">
            Back to Notes
          </a>
        </main>
      );
    throw e;
  }
}
