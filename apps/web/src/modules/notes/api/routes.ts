import { webActor } from "@/lib/auth/server";
import { sameOrigin, jsonInput, privateJson, failure } from "@/lib/http";
import { boundedBody } from "@/lib/bounded-body";
import { appOrigin } from "@/lib/config";
import { idSchema, AppError } from "@wuff/contracts";
import * as notes from "@wuff/domain/modules/notes";
import { after } from "next/server";
import { processGithubJobs } from "@wuff/domain/modules/todo";
export async function search(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    return privateJson(
      await notes.searchNotes(await webActor(), {
        search: q.get("search") ?? "",
        ...(q.has("tag") ? { tag: q.get("tag") } : {}),
        filter: q.get("filter") ?? "all",
        limit: Number(q.get("limit") ?? 50),
        offset: Number(q.get("offset") ?? 0),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function create(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await notes.createNote(
        await webActor(),
        await jsonInput(request, 32_768),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function read(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return privateJson(
      await notes.getNote(
        await webActor(),
        idSchema.parse((await context.params).id),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function update(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const actor = await webActor(),
      id = idSchema.parse((await context.params).id),
      input = await jsonInput(request, 32_768);
    if (input.noteId !== id)
      throw new AppError(
        "invalid_input",
        "Note identity does not match the route.",
      );
    return privateJson(await notes.updateNote(actor, input));
  } catch (e) {
    return failure(e);
  }
}
export async function settingsGet() {
  try {
    return privateJson(await notes.getNotesSettings(await webActor()));
  } catch (e) {
    return failure(e);
  }
}
export async function settingsPut(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await notes.updateNotesSettings(
        await webActor(),
        await jsonInput(request),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function dashboard() {
  try {
    return privateJson(await notes.getNotesDashboard(await webActor()));
  } catch (e) {
    return failure(e);
  }
}
export async function exportTask(request: Request) {
  try {
    sameOrigin(request);
    const result = await notes.createNoteTask(
      await webActor(),
      await jsonInput(request),
      appOrigin(),
    );
    after(() => processGithubJobs());
    return privateJson(result);
  } catch (e) {
    return failure(e);
  }
}
export async function imageUpload(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(),
      bytes = await boundedBody(
        request,
        4 * Math.ceil((3 * 1024 * 1024) / 3) + 16_384,
      );
    return privateJson(
      await notes.uploadNoteImage(actor, parseImageInput(bytes)),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function imageRead(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const result = await notes.readNoteImage(
      await webActor(),
      idSchema.parse((await context.params).id),
    );
    return new Response(result.stream as ReadableStream, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    const response = failure(e);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

function parseImageInput(bytes: Uint8Array) {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError("invalid_json", "Invalid request body.", 400);
  }
}
