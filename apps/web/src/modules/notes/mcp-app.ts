import {
  notePath,
  type NotesResult,
  type NoteDetail,
  type NotesSettings,
  type ListSummary,
} from "@wuff/contracts";
import { listThemeVariables, listPalette } from "@wuff/design";
import { element, button } from "@/mcp-app/dom";
import { ToolError, type McpViewRuntime } from "@/mcp-app/runtime";
import { renderTaskMarkdown } from "@wuff/ui/modules/todo/lib/task-markdown";
export function renderNotesMcp(
  runtime: McpViewRuntime,
  value: Record<string, unknown>,
) {
  const { root: hostRoot, status, request, show, call } = runtime;
  const root = element("section");
  root.className = "notes-mcp-view";
  hostRoot.append(root);
  const data = value.note as NoteDetail | undefined,
    collection = value.notes as NotesResult | undefined,
    prefs = value.notesSettings as NotesSettings | undefined;
  const theme = data?.theme ?? "sand";
  for (const [key, color] of Object.entries(listThemeVariables(theme)))
    document.documentElement.style.setProperty(key, color);
  const heading = element(
    "h1",
    data?.title ?? (prefs ? "Notes preferences" : "Wuff Notes"),
  );
  root.append(heading);
  const feedback = element("div");
  feedback.setAttribute("role", "status");
  root.append(feedback);
  let busy = false,
    pending: { name: string; args: Record<string, unknown> } | null = null;
  async function run(name: string, args: Record<string, unknown>) {
    if (busy) return;
    busy = true;
    pending = { name, args };
    const controls = [
      ...root.querySelectorAll<
        | HTMLInputElement
        | HTMLButtonElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      >("button,input,textarea,select"),
    ];
    const disabled = controls.map((c) => c.disabled);
    controls.forEach((c) => (c.disabled = true));
    feedback.replaceChildren(element("p", "Saving…"));
    try {
      const result = await request(name, args);
      pending = null;
      show(result);
      status.textContent = "Notes saved.";
    } catch (error) {
      feedback.setAttribute("role", "alert");
      feedback.replaceChildren(element("p", (error as Error).message));
      const uncertain =
        !(error instanceof ToolError) || error.code === "internal_error";
      if (uncertain)
        feedback.append(
          button(
            "Retry same request",
            () => void run(pending!.name, pending!.args),
          ),
        );
      else {
        pending = null;
        controls.forEach((c, i) => (c.disabled = disabled[i]));
        feedback.append(
          button(
            "Load latest Notes",
            () =>
              void call(
                data ? "get_note" : "show_notes",
                data ? { noteId: data.id } : {},
              ),
          ),
        );
      }
    } finally {
      busy = false;
    }
  }
  const change = (action: Record<string, unknown>) => {
    if (!data) return;
    const management = ["share", "unshare", "trash", "restore"].includes(
      String(action.action),
    );
    void run(management ? "manage_note" : "update_note", {
      noteId: data.id,
      version: data.version,
      operationId: crypto.randomUUID(),
      change: action,
    });
  };
  function field(
    name: string,
    input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ) {
    const label = element("label", name);
    input.setAttribute("aria-label", name);
    label.append(input);
    root.append(label);
    return input;
  }
  function input(name: string, text = "") {
    const i = element("input");
    i.value = text;
    return field(name, i) as HTMLInputElement;
  }
  function select(name: string, choices: readonly string[], selected: string) {
    const s = element("select");
    for (const choice of choices) {
      const o = element("option", choice);
      o.value = choice;
      o.selected = choice === selected;
      s.append(o);
    }
    field(name, s);
    return s;
  }
  root.append(
    button("All notes", () => void call("show_notes", {})),
    button("Notes preferences", () => void call("get_notes_settings", {})),
  );
  const web = element("a", "Open full Notes");
  web.href = new URL(
    data ? notePath(data.id) : "/notes",
    runtime.webOrigin,
  ).href;
  web.target = "_blank";
  web.rel = "noopener";
  root.append(web);
  if (prefs) {
    const mode = select(
        "Default format",
        ["note", "moodboard"],
        prefs.settings.defaultMode,
      ),
      palette = select(
        "Default theme",
        Object.keys(listPalette),
        prefs.settings.defaultTheme,
      ),
      dashboard = select(
        "Dashboard selection",
        ["pinned", "recent"],
        prefs.settings.dashboard,
      ),
      count = select(
        "Dashboard note count",
        ["1", "2", "3", "4", "5", "6", "7", "8"],
        String(prefs.settings.dashboardLimit),
      );
    root.append(
      button(
        "Save Notes preferences",
        () =>
          void run("update_notes_settings", {
            version: prefs.version,
            operationId: crypto.randomUUID(),
            settings: {
              defaultMode: mode.value,
              defaultTheme: palette.value,
              dashboard: dashboard.value,
              dashboardLimit: Number(count.value),
            },
          }),
      ),
    );
    return;
  }
  if (collection) {
    const search = input("Search notes"),
      filter = select(
        "Notes filter",
        ["all", "pinned", "shared", "archived", "trash"],
        "all",
      );
    root.append(
      button(
        "Search",
        () =>
          void call("show_notes", {
            search: search.value,
            filter: filter.value,
          }),
      ),
    );
    root.append(element("p", `${collection.total} accessible notes`));
    for (const note of collection.notes) {
      const row = element("section");
      row.append(
        button(note.title, () => void call("get_note", { noteId: note.id })),
        element(
          "p",
          `${note.mode} · ${note.pinned ? "Pinned · " : ""}${note.tags.join(", ")}`,
        ),
      );
      root.append(row);
    }
    const title = input("New note title"),
      mode = select("New note format", ["note", "moodboard"], "note");
    root.append(
      button("Create private note", () => {
        if (title.value.trim())
          void run("create_note", {
            title: title.value,
            content: "",
            tags: [],
            mode: mode.value,
            theme: "sand",
            operationId: crypto.randomUUID(),
          });
      }),
    );
    return;
  }
  if (!data) return;
  root.append(
    element(
      "p",
      `${data.role} · ${data.mode}${data.trashed ? " · In trash" : ""}`,
    ),
  );
  const preview = element("div");
  preview.className = "task-prose";
  preview.innerHTML = renderTaskMarkdown(data.content, {
    imageSource: () => null,
  });
  root.append(preview);
  const title = input("Note title", data.title),
    tags = input("Note tags", data.tags.join(", ")),
    mode = select("Note format", ["note", "moodboard"], data.mode),
    palette = select("Note theme", Object.keys(listPalette), data.theme),
    content = element("textarea");
  content.value = data.content;
  content.rows = 9;
  field("Note content (Markdown)", content);
  for (const control of [title, tags, mode, palette, content])
    control.disabled = !data.canEdit;
  root.append(
    button(
      "Save note",
      () =>
        change({
          action: "save",
          title: title.value,
          content: content.value,
          tags: tags.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          mode: mode.value,
          theme: palette.value,
        }),
      !data.canEdit,
    ),
  );
  root.append(
    button(
      data.pinned ? "Unpin" : "Pin",
      () =>
        change({
          action: "preference",
          preferenceVersion: data.preferenceVersion,
          pinned: !data.pinned,
          archived: data.archived,
        }),
      !data.canPersonalize,
    ),
    button(
      data.archived ? "Restore for me" : "Archive for me",
      () =>
        change({
          action: "preference",
          preferenceVersion: data.preferenceVersion,
          pinned: data.pinned,
          archived: !data.archived,
        }),
      !data.canPersonalize,
    ),
  );
  root.append(element("h2", "Linked notes"));
  for (const link of data.links)
    root.append(
      button(link.title, () => void call("get_note", { noteId: link.id })),
      button(
        `Unlink ${link.title}`,
        () => change({ action: "unlink", targetId: link.id }),
        !data.canEdit,
      ),
    );
  root.append(element("h2", "Linked from"));
  for (const link of data.backlinks)
    root.append(
      button(link.title, () => void call("get_note", { noteId: link.id })),
    );
  const target = select("Note to link", [], ""),
    targetSearch = input("Find a note to link");
  async function findTargets() {
    try {
      const result = await runtime.callServerTool({
        name: "search_notes",
        arguments: { search: targetSearch.value, limit: 50 },
      });
      if (result.isError) throw new Error("Could not load your notes.");
      const choices = (
        result.structuredContent as unknown as { notes: NotesResult }
      ).notes.notes.filter((n) => n.id !== data!.id);
      target.replaceChildren(
        ...choices.map((n) => {
          const o = element("option", n.title);
          o.value = n.id;
          return o;
        }),
      );
    } catch (error) {
      feedback.textContent = (error as Error).message;
    }
  }
  root.append(button("Find notes", () => void findTargets()));
  void findTargets();
  root.append(
    button(
      "Link note",
      () => change({ action: "link", targetId: target.value }),
      !data.canEdit,
    ),
    button(
      "Add linked note card",
      () =>
        change({
          action: "add_card",
          body: { kind: "note", targetId: target.value },
        }),
      !data.canEdit,
    ),
  );
  if (data.mode === "moodboard") {
    root.append(element("h2", "Moodboard"));
    for (const [order, card] of data.cards.entries()) {
      const section = element("section");
      section.className = "notes-mcp-card";
      if (card.body.kind === "text") {
        section.append(element("h3", card.body.title));
        const body = element("div");
        body.className = "task-prose";
        body.innerHTML = renderTaskMarkdown(card.body.text, {
          imageSource: () => null,
        });
        section.append(body);
      } else if (card.body.kind === "link") {
        const link = element("a", card.body.title);
        link.href = card.body.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        section.append(link);
      } else if (card.body.kind === "note") {
        section.append(
          card.target
            ? button(
                card.target.title,
                () => void call("get_note", { noteId: card.target!.id }),
              )
            : element("p", "Linked note unavailable"),
        );
      } else {
        const assetId = card.body.assetId,
          caption = card.body.caption;
        section.append(element("p", caption || "Private image"));
        const image = element("img");
        image.alt = caption;
        void runtime
          .callServerTool({ name: "get_note_image", arguments: { assetId } })
          .then((result) => {
            const c = result.content?.find((item) => item.type === "image");
            if (
              c?.type === "image" &&
              c.mimeType === "image/webp" &&
              !result.isError
            ) {
              image.src = `data:image/webp;base64,${c.data}`;
              section.prepend(image);
            }
          })
          .catch(() => section.append(element("p", "Image unavailable")));
      }
      section.append(
        button(
          `Remove card ${order + 1}`,
          () => change({ action: "remove_card", cardId: card.id }),
          !data.canEdit,
        ),
      );
      for (const [d, label] of [
        [-1, "up"],
        [1, "down"],
      ] as const) {
        const ids = data.cards.map((c) => c.id),
          to = order + d;
        if (to >= 0 && to < ids.length) {
          [ids[order], ids[to]] = [ids[to], ids[order]];
          section.append(
            button(
              `Move card ${order + 1} ${label}`,
              () => change({ action: "reorder_cards", cardIds: ids }),
              !data.canEdit,
            ),
          );
        }
      }
      root.append(section);
    }
    const cardTitle = input("Card heading"),
      cardText = element("textarea");
    cardText.rows = 4;
    field("Card text", cardText);
    root.append(
      button(
        "Add text card",
        () =>
          change({
            action: "add_card",
            body: {
              kind: "text",
              title: cardTitle.value,
              text: cardText.value,
            },
          }),
        !data.canEdit,
      ),
    );
    const url = input("Card link address"),
      urlTitle = input("Card link title");
    root.append(
      button(
        "Add link card",
        () =>
          change({
            action: "add_card",
            body: { kind: "link", url: url.value, title: urlTitle.value },
          }),
        !data.canEdit,
      ),
    );
    const editCard = select("Card to edit", [], ""),
      editTitle = input("Edit card heading"),
      editText = element("textarea"),
      editUrl = input("Edit card address"),
      editCaption = input("Edit image description");
    field("Edit card text", editText);
    const editable = data.cards.filter(
      (c) =>
        c.body.kind === "text" ||
        c.body.kind === "link" ||
        c.body.kind === "image",
    );
    for (const [i, card] of editable.entries()) {
      const o = element(
        "option",
        `Card ${data.cards.indexOf(card) + 1} · ${card.body.kind}`,
      );
      o.value = card.id;
      editCard.append(o);
    }
    function selectCard() {
      const card = editable.find((c) => c.id === editCard.value);
      editTitle.value =
        card?.body.kind === "text" || card?.body.kind === "link"
          ? card.body.title
          : "";
      editText.value = card?.body.kind === "text" ? card.body.text : "";
      editUrl.value = card?.body.kind === "link" ? card.body.url : "";
      editCaption.value = card?.body.kind === "image" ? card.body.caption : "";
      editText.closest("label")!.hidden = card?.body.kind !== "text";
      editUrl.closest("label")!.hidden = card?.body.kind !== "link";
      editCaption.closest("label")!.hidden = card?.body.kind !== "image";
      editTitle.closest("label")!.hidden = card?.body.kind === "image";
    }
    editCard.onchange = selectCard;
    selectCard();
    root.append(
      button(
        "Save card changes",
        () => {
          const card = editable.find((c) => c.id === editCard.value);
          if (!card) return;
          const body =
            card.body.kind === "text"
              ? { kind: "text", title: editTitle.value, text: editText.value }
              : card.body.kind === "link"
                ? { kind: "link", title: editTitle.value, url: editUrl.value }
                : card.body.kind === "image"
                  ? { ...card.body, caption: editCaption.value }
                  : null;
          if (body) change({ action: "update_card", cardId: card.id, body });
        },
        !data.canEdit || !editable.length,
      ),
    );
    const file = element("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.disabled = !data.canEdit;
    field("Upload private board image", file);
    file.onchange = async () => {
      const selected = file.files?.[0];
      if (!selected || selected.size > 3 * 1024 * 1024) {
        feedback.textContent = "Choose an image up to 3 MiB.";
        return;
      }
      const bytes = new Uint8Array(await selected.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      void run("upload_note_image", {
        noteId: data.id,
        version: data.version,
        operationId: crypto.randomUUID(),
        imageBase64: btoa(binary),
      });
    };
    const caption = input("Image description");
    for (const [imageIndex, asset] of data.assets
      .filter((a) => a.ready)
      .entries())
      root.append(
        button(
          `Add uploaded image ${imageIndex + 1}`,
          () =>
            change({
              action: "add_card",
              body: {
                kind: "image",
                assetId: asset.id,
                caption: caption.value,
              },
            }),
          !data.canEdit,
        ),
      );
  }
  if (data.canManage) {
    root.append(
      element("h2", "Sharing"),
      element(
        "p",
        "Only share with explicit user intent. Linked notes keep their own access.",
      ),
    );
    const email = input("Share with account email"),
      role = select("Access role", ["viewer", "editor"], "viewer");
    root.append(
      button("Grant access", () =>
        change({ action: "share", email: email.value, role: role.value }),
      ),
    );
    for (const member of data.members ?? [])
      root.append(
        element("p", `${member.name} · ${member.role}`),
        button(`Remove ${member.name}`, () =>
          change({ action: "unshare", userId: member.userId }),
        ),
      );
    root.append(
      button(data.trashed ? "Restore note" : "Move to trash", () =>
        change({ action: data.trashed ? "restore" : "trash" }),
      ),
    );
  }
  if (data.canExport && !data.trashed) {
    root.append(
      element("h2", "Create Todo task"),
      element(
        "p",
        "Choose a list explicitly. Its members/integrations may see copied text. Linked notes/images are not copied.",
      ),
    );
    const destination = select("Destination Todo list", [], ""),
      taskTitle = input("Todo task title", data.title),
      copy = element("input"),
      confirm = element("input");
    let destinations: ListSummary[] = [];
    async function loadDestinations() {
      try {
        const result = await runtime.callServerTool({
          name: "list_lists",
          arguments: {},
        });
        if (result.isError)
          throw new Error(
            "Could not load Todo lists. Check your connection's Todo tool choices.",
          );
        destinations = (
          result.structuredContent as unknown as { lists: ListSummary[] }
        ).lists.filter((l) => !l.archived);
        destination.replaceChildren(
          ...destinations.map((l) => {
            const o = element("option", l.title);
            o.value = l.id;
            return o;
          }),
        );
        confirm.checked = false;
      } catch (error) {
        feedback.textContent = (error as Error).message;
      }
    }
    destination.onchange = () => {
      confirm.checked = false;
    };
    root.append(
      button("Refresh destination lists", () => void loadDestinations()),
    );
    void loadDestinations();
    copy.type = "checkbox";
    confirm.type = "checkbox";
    field("Copy note text", copy);
    field("I confirm the chosen list may receive this copy", confirm);
    root.append(
      button("Create Todo task", () => {
        if (!confirm.checked) {
          feedback.textContent =
            "Confirm the destination before creating a task.";
          return;
        }
        void run("create_note_task", {
          noteId: data.id,
          version: data.version,
          listId: destination.value,
          listVersion:
            destinations.find((l) => l.id === destination.value)?.version ?? -1,
          title: taskTitle.value,
          includeContent: copy.checked,
          confirmed: true,
          operationId: crypto.randomUUID(),
        });
      }),
    );
  }
  if (data.role !== "owner")
    root.append(
      button(
        "Leave shared note",
        () => change({ action: "leave" }),
        !data.canPersonalize,
      ),
    );
}
