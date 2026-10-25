import { pageActor } from "@/lib/auth/server";
import { getNotesSettings } from "@wuff/domain/modules/notes";
import { NotesSettingsPanel } from "@wuff/ui/modules/notes/settings";
import "@wuff/ui/modules/notes/notes.css";
export default async function NotesSettingsPage() {
  return (
    <NotesSettingsPanel initial={await getNotesSettings(await pageActor())} />
  );
}
