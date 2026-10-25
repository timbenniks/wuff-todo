import * as notes from "@wuff/domain/modules/notes";
import { idSchema } from "@wuff/contracts";
import type { Actor } from "@wuff/contracts";
import { appOrigin } from "@/lib/config";
export const notesNativeOperations = {
  getNoteImage: notes.readNoteImageBase64,
  searchNotes: notes.searchNotes,
  getNote: (actor: Actor, input: unknown) =>
    notes.getNote(actor, idSchema.parse(input)),
  createNote: notes.createNote,
  updateNote: notes.updateNote,
  getNotesSettings: notes.getNotesSettings,
  updateNotesSettings: notes.updateNotesSettings,
  getNotesDashboard: notes.getNotesDashboard,
  uploadNoteImage: notes.uploadNoteImage,
  createNoteTask: (actor: Actor, input: unknown) =>
    notes.createNoteTask(actor, input, appOrigin()),
};

export { readNoteImage } from "@wuff/domain/modules/notes";
