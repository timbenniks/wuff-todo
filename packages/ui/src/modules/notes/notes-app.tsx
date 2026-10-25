"use client";
import {
  useState,
  useEffect,
  useRef,
  lazy,
  Suspense,
  type CSSProperties,
} from "react";
import {
  FileText,
  LayoutGrid,
  Search,
  Pin,
  Archive,
  Users,
  Plus,
  ArrowLeft,
  Link2,
  ImagePlus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { Button } from "../../button";
import { Input } from "../../input";
import { NativeSelect } from "../../native-select";
import { useActorApi } from "../../features/actor-api";
import { useRuntime } from "../../features/runtime";
import { TaskMarkdown } from "../todo/components/task-markdown";
import { listThemeVariables, listPalette } from "@wuff/design";
import {
  notePath,
  noteExcerpt,
  type NoteDetail,
  type NoteFields,
  type NotesResult,
  type NotesSettings,
  type NoteMutation,
  type BoardBody,
  type ListSummary,
  type NoteCard,
} from "@wuff/contracts";
import {
  uncertainNotesError,
  moveNoteCard,
  type NotesRequest,
  noteDateLabel,
} from "./recovery";
const RichEditor = lazy(() => import("../todo/app/lists/task-note-editor"));
const filters = [
  ["all", "All notes"],
  ["pinned", "Pinned"],
  ["shared", "Shared"],
  ["archived", "Archive"],
  ["trash", "Trash"],
] as const;
function fields(note: NoteDetail): NoteFields {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags,
    mode: note.mode,
    theme: note.theme,
  };
}
function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="notes-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <Button
          aria-label={`Close ${title}`}
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export function NotesApp({
  userId,
  initial,
  initialNote,
  settings,
  initialFilter = "all",
}: {
  userId: string;
  initial: NotesResult;
  initialNote: NoteDetail | null;
  settings: NotesSettings;
  initialFilter?: string;
}) {
  const api = useActorApi(),
    runtime = useRuntime();
  const [library, setLibrary] = useState(initial),
    [note, setNote] = useState(initialNote),
    [draft, setDraft] = useState<NoteFields | null>(
      initialNote ? fields(initialNote) : null,
    ),
    [tags, setTags] = useState(initialNote?.tags.join(", ") ?? ""),
    [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState(initialFilter),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [tag, setTag] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<NotesRequest | null>(null),
    [remote, setRemote] = useState(false),
    [denied, setDenied] = useState(false);
  const [modal, setModal] = useState<
      "create" | "share" | "link" | "card" | "task" | "trash" | null
    >(null),
    [createdTask, setCreatedTask] = useState<{
      path: string;
      title: string;
    } | null>(null);
  const [newTitle, setNewTitle] = useState(""),
    [newMode, setNewMode] = useState<"note" | "moodboard">(
      settings.settings.defaultMode,
    ),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("viewer"),
    [linkTarget, setLinkTarget] = useState(""),
    [linkSearch, setLinkSearch] = useState(""),
    [linkChoices, setLinkChoices] = useState(initial.notes);
  const [cardKind, setCardKind] = useState<BoardBody["kind"]>("text"),
    [cardTitle, setCardTitle] = useState(""),
    [cardText, setCardText] = useState(""),
    [cardUrl, setCardUrl] = useState(""),
    [editingCard, setEditingCard] = useState<string | null>(null);
  const [listOptions, setListOptions] = useState<ListSummary[]>([]),
    [listId, setListId] = useState(""),
    [taskTitle, setTaskTitle] = useState(""),
    [copyContent, setCopyContent] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const pendingAck = useRef<(value: any) => void>(() => {}),
    state = useRef({ note, draft, editing, busy, pending, denied });
  state.current = { note, draft, editing, busy, pending, denied };
  const dirty =
    !!note &&
    !!draft &&
    editing &&
    (draft.title !== note.title ||
      draft.content !== note.content ||
      draft.mode !== note.mode ||
      draft.theme !== note.theme ||
      tags !== note.tags.join(", "));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const locked = busy || !!pending || denied;
  function navigate(path: string) {
    if (dirty || pending) {
      setError(
        "Save or cancel your changes before leaving. An uncertain save must be retried first.",
      );
      return;
    }
    runtime.navigate(path);
  }
  function accept(next: NoteDetail, reset = true) {
    setNote(next);
    setDenied(false);
    setRemote(false);
    if (reset) {
      setDraft(fields(next));
      setTags(next.tags.join(", "));
    }
  }
  async function loadLibrary() {
    setLoading(true);
    try {
      const result = await api<NotesResult>(
        `/api/v1/notes?search=${encodeURIComponent(search)}&offset=${offset}&filter=${filter}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`,
      );
      if (result.userId === userId) setLibrary(result);
    } catch (e) {
      setLibrary({ userId, notes: [], total: 0, tags: [] });
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void api<NotesResult>(
        `/api/v1/notes?search=${encodeURIComponent(search)}&offset=${offset}&filter=${filter}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`,
      )
        .then((result) => {
          if (active && result.userId === userId) setLibrary(result);
        })
        .catch((e) => {
          if (active) {
            setLibrary({ userId, notes: [], total: 0, tags: [] });
            setError(e.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, userId, search, filter, tag, offset]);
  useEffect(() => {
    setOffset(0);
  }, [search, filter, tag]);
  useEffect(() => {
    async function refresh() {
      if (document.hidden || state.current.busy || state.current.pending)
        return;
      const current = state.current.note;
      if (!current) return;
      try {
        const next = await api<NoteDetail>(`/api/v1/notes/${current.id}`);
        if (state.current.note?.id !== next.id || next.userId !== userId)
          return;
        if (dirtyRef.current) {
          if (next.version !== current.version) setRemote(true);
          setNote((old) =>
            old
              ? { ...old, canEdit: next.canEdit, canManage: next.canManage }
              : old,
          );
        } else accept(next);
      } catch (e) {
        if (state.current.note?.id === current.id) {
          setDenied(true);
          setError(
            "Access or connection changed. Your draft is kept. Retry loading before saving.",
          );
        }
      }
    }
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [api, userId]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || state.current.pending) e.preventDefault();
    };
    const anchor = (e: MouseEvent) => {
      if (!dirtyRef.current && !state.current.pending) return;
      const a = (e.target as HTMLElement).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (a && a.target !== "_blank" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        setError(
          "Save or cancel your changes before leaving. An uncertain save must be retried first.",
        );
      }
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", anchor, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", anchor, true);
    };
  }, []);
  async function send(request: NotesRequest, onAck: (value: any) => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    pendingAck.current = onAck;
    try {
      const value = await api<any>(request.path, request.method, request.body);
      setPending(null);
      onAck(value);
      setFeedback("Saved to your Wuff account.");
      void loadLibrary();
    } catch (e) {
      setError((e as Error).message);
      if (uncertainNotesError(e)) setPending(request);
      else setPending(null);
    } finally {
      setBusy(false);
    }
  }
  const mutate = (
    change: NoteMutation["change"],
    onAck?: (value: any) => void,
  ) => {
    if (!note || locked) return;
    void send(
      {
        path: `/api/v1/notes/${note.id}`,
        method: "PUT",
        body: {
          noteId: note.id,
          version: note.version,
          operationId: crypto.randomUUID(),
          change,
        },
      },
      (value) => {
        if (value.left) {
          runtime.navigate("/notes");
          return;
        }
        accept(value, change.action !== "preference" || !dirty);
        onAck?.(value);
      },
    );
  };
  async function reloadNote() {
    if (!note) return;
    setBusy(true);
    try {
      accept(await api<NoteDetail>(`/api/v1/notes/${note.id}`));
      setError("");
    } catch (e) {
      setDenied(true);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (modal !== "link" && !(modal === "card" && cardKind === "note")) return;
    let active = true;
    void api<NotesResult>(
      `/api/v1/notes?search=${encodeURIComponent(linkSearch)}&limit=50`,
    )
      .then((value) => {
        if (active) setLinkChoices(value.notes);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [api, modal, cardKind, linkSearch]);
  async function loadLists() {
    try {
      setListOptions(await api<ListSummary[]>("/api/v1/lists"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function openTask() {
    setTaskTitle(note?.title ?? "");
    setConfirmed(false);
    setCopyContent(false);
    setModal("task");
    void loadLists();
  }
  async function upload(file: File) {
    if (!note || locked) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Choose an image up to 3 MiB.");
      return;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);
    void send(
      {
        path: "/api/v1/notes/images",
        method: "POST",
        body: {
          noteId: note.id,
          version: note.version,
          operationId: crypto.randomUUID(),
          imageBase64: btoa(binary),
        },
      },
      (value) => {
        accept(value.note);
        setFeedback("Image uploaded. Choose it below to add a card.");
      },
    );
  }
  function addCard(body: BoardBody) {
    mutate(
      editingCard
        ? { action: "update_card", cardId: editingCard, body }
        : { action: "add_card", body },
      () => {
        setModal(null);
        setEditingCard(null);
        setCardText("");
        setCardTitle("");
        setCardUrl("");
      },
    );
  }
  function openCard(card?: NoteCard) {
    setEditingCard(card?.id ?? null);
    setCardKind(card?.body.kind ?? "text");
    setCardTitle(
      card?.body.kind === "text" || card?.body.kind === "link"
        ? card.body.title
        : "",
    );
    setCardText(
      card?.body.kind === "text"
        ? card.body.text
        : card?.body.kind === "image"
          ? card.body.caption
          : "",
    );
    setCardUrl(card?.body.kind === "link" ? card.body.url : "");
    setModal("card");
  }
  const currentTheme = note?.theme ?? settings.settings.defaultTheme;
  return (
    <div
      className="notes-workspace"
      style={listThemeVariables(currentTheme) as CSSProperties}
    >
      <aside className="notes-sidebar">
        <a href="/notes" className="notes-wordmark">
          <FileText size={21} />
          Wuff Notes
        </a>
        <p className="notes-kicker">A little space for your thoughts.</p>
        <Button
          onClick={() => {
            if (dirty) {
              setError("Save or cancel your draft first.");
              return;
            }
            setNewTitle("");
            setModal("create");
          }}
          disabled={locked}
        >
          <Plus size={17} />
          New note
        </Button>
        <nav aria-label="Notes pages">
          {filters.map(([value, label]) => (
            <button
              key={value}
              aria-current={!note && filter === value ? "page" : undefined}
              disabled={busy || !!pending}
              onClick={() => {
                if (note) {
                  navigate(`/notes?filter=${value}`);
                  return;
                }
                setFilter(value);
              }}
            >
              {value === "pinned" ? (
                <Pin size={17} />
              ) : value === "shared" ? (
                <Users size={17} />
              ) : value === "archived" ? (
                <Archive size={17} />
              ) : value === "trash" ? (
                <Trash2 size={17} />
              ) : (
                <FileText size={17} />
              )}
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="notes-sidebar-bottom">
          <a href="/settings/notes">
            <Settings size={17} />
            Notes preferences
          </a>
          <a href="/">
            <ArrowLeft size={17} />
            Empire dashboard
          </a>
        </div>
      </aside>
      <main id="empire-content" className="notes-main">
        <header className="notes-page-header">
          <div>
            <p className="empire-eyebrow">Wuff Notes</p>
            <h1>
              {note
                ? note.title
                : (filters.find(([v]) => v === filter)?.[1] ?? "All notes")}
            </h1>
            {note && (
              <p className="notes-muted">
                {note.role === "owner"
                  ? "Your note"
                  : `Shared by ${note.ownerName}`}{" "}
                · {note.mode === "moodboard" ? "Moodboard" : "Note"}
                {note.archived ? " · Archived for you" : ""}
                {note.trashed ? " · In trash" : ""}
              </p>
            )}
          </div>
          {note && (
            <Button
              variant="outline"
              disabled={busy || !!pending}
              onClick={() => navigate("/notes")}
            >
              <ArrowLeft size={16} />
              All notes
            </Button>
          )}
        </header>
        {error && !modal && (
          <div role="alert" className="notes-alert">
            <p>{error}</p>
            {pending && (
              <p>
                The outcome is uncertain. Retry sends the identical request.
              </p>
            )}
            {pending && (
              <Button
                disabled={busy}
                onClick={() => void send(pending, pendingAck.current)}
              >
                Retry same request
              </Button>
            )}
            {denied && !pending && (
              <Button disabled={busy} onClick={() => void reloadNote()}>
                Retry loading note
              </Button>
            )}
          </div>
        )}
        {feedback && (
          <p role="status" className="notes-feedback">
            {feedback}
          </p>
        )}
        {busy && <p role="status">Saving…</p>}
        {!note ? (
          <>
            <div className="notes-library-toolbar">
              <label className="notes-search">
                <Search size={18} />
                <Input
                  aria-label="Search notes"
                  placeholder="Search your notes, tags and boards"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="notes-tag-filter">
                Tag
                <NativeSelect
                  aria-label="Filter by tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">All tags</option>
                  {library.tags.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <p className="notes-muted" role="status">
              {loading
                ? "Fetching your notes…"
                : `${library.total} ${library.total === 1 ? "note" : "notes"}`}
            </p>
            <div className="notes-library">
              {library.notes.map((item) => (
                <a
                  className="notes-library-card"
                  href={notePath(item.id)}
                  key={item.id}
                  style={listThemeVariables(item.theme) as CSSProperties}
                >
                  <div className="notes-card-top">
                    {item.mode === "moodboard" ? (
                      <LayoutGrid size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                    <span>
                      {item.mode === "moodboard" ? "Moodboard" : "Note"}
                    </span>
                    {item.pinned && <Pin size={16} aria-label="Pinned" />}
                  </div>
                  <h2>{item.title}</h2>
                  <p>
                    {noteExcerpt(item.content) ||
                      "A little room for your next idea."}
                  </p>
                  <div className="notes-tags">
                    {item.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <footer>
                    {item.shared ? (
                      <span>
                        <Users size={13} />
                        Shared
                      </span>
                    ) : (
                      <span>Private</span>
                    )}
                    <span>{noteDateLabel(item.updatedAt)}</span>
                  </footer>
                </a>
              ))}
            </div>
            {!loading && !library.notes.length && (
              <section className="notes-empty">
                <FileText size={40} />
                <h2>
                  {search || tag
                    ? "No notes found"
                    : "Your next idea belongs here"}
                </h2>
                <p>
                  {search || tag
                    ? "Try a different search or clear the tag filter."
                    : "Keep a thought, collect inspiration, or start a board. New notes are private."}
                </p>
                <Button onClick={() => setModal("create")}>
                  Create a note
                </Button>
              </section>
            )}
            {(offset > 0 || library.total > 50) && (
              <nav aria-label="Notes pages" className="notes-actions">
                <Button
                  variant="outline"
                  disabled={loading || offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous notes
                </Button>
                <span>
                  {offset + 1}–
                  {Math.min(offset + library.notes.length, library.total)} of{" "}
                  {library.total}
                </span>
                <Button
                  variant="outline"
                  disabled={loading || offset + 50 >= library.total}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next notes
                </Button>
              </nav>
            )}
          </>
        ) : (
          <>
            <div className="notes-actions">
              <Button
                variant="outline"
                disabled={locked || note.trashed}
                aria-pressed={note.pinned}
                onClick={() =>
                  mutate({
                    action: "preference",
                    preferenceVersion: note.preferenceVersion,
                    pinned: !note.pinned,
                    archived: note.archived,
                  })
                }
              >
                <Pin size={16} />
                {note.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button
                variant="outline"
                disabled={locked || note.trashed}
                onClick={() =>
                  mutate({
                    action: "preference",
                    preferenceVersion: note.preferenceVersion,
                    pinned: note.pinned,
                    archived: !note.archived,
                  })
                }
              >
                <Archive size={16} />
                {note.archived ? "Restore for me" : "Archive for me"}
              </Button>
              {note.canEdit && (
                <Button disabled={locked} onClick={() => setEditing(true)}>
                  Edit note
                </Button>
              )}
              {note.canManage && (
                <Button
                  variant="outline"
                  disabled={locked || dirty || note.trashed}
                  onClick={() => setModal("share")}
                >
                  <Users size={16} />
                  Share
                </Button>
              )}
              <Button
                variant="outline"
                disabled={locked || dirty || note.trashed}
                onClick={openTask}
              >
                Create Todo task
              </Button>
              {note.canManage && (
                <Button
                  variant="ghost"
                  disabled={locked || dirty}
                  onClick={() =>
                    note.trashed
                      ? mutate({ action: "restore" })
                      : setModal("trash")
                  }
                >
                  {note.trashed ? "Restore note" : "Move to trash"}
                </Button>
              )}
              {note.role !== "owner" && (
                <Button
                  variant="ghost"
                  disabled={locked || dirty}
                  onClick={() => mutate({ action: "leave" })}
                >
                  Leave shared note
                </Button>
              )}
            </div>
            {remote && (
              <div className="notes-alert" role="status">
                <p>This note changed elsewhere. Your draft is kept.</p>
                <Button disabled={locked} onClick={() => void reloadNote()}>
                  Load latest note
                </Button>
              </div>
            )}
            {editing && draft ? (
              <section className="notes-editor-panel" aria-label="Edit note">
                <label>
                  Title
                  <Input
                    aria-label="Note title"
                    value={draft.title}
                    maxLength={300}
                    disabled={locked || !note.canEdit}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <div className="notes-editor-options">
                  <label>
                    Tags, separated by commas
                    <Input
                      aria-label="Note tags"
                      value={tags}
                      disabled={locked || !note.canEdit}
                      onChange={(e) => setTags(e.target.value)}
                    />
                  </label>
                  <label>
                    Format
                    <NativeSelect
                      aria-label="Note format"
                      value={draft.mode}
                      disabled={locked || !note.canEdit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          mode: e.target.value as NoteFields["mode"],
                        })
                      }
                    >
                      <option value="note">Note</option>
                      <option value="moodboard">Moodboard</option>
                    </NativeSelect>
                  </label>
                  <label>
                    Theme
                    <NativeSelect
                      aria-label="Note theme"
                      value={draft.theme}
                      disabled={locked || !note.canEdit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          theme: e.target.value as NoteFields["theme"],
                        })
                      }
                    >
                      {Object.entries(listPalette).map(([key, p]) => (
                        <option key={key} value={key}>
                          {p.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                <label>Content</label>
                <Suspense fallback={<p role="status">Opening the editor…</p>}>
                  <RichEditor
                    key={note.id + ":" + note.version}
                    label="Note content"
                    allowImages={false}
                    value={draft.content}
                    disabled={locked || !note.canEdit}
                    onUpload={async () => {
                      throw new Error("Add private images as moodboard cards.");
                    }}
                    onChange={(content) =>
                      setDraft((current) =>
                        current ? { ...current, content } : current,
                      )
                    }
                  />
                </Suspense>
                <p className="notes-muted">
                  {draft.content.length}/16,000 characters. Images belong in
                  moodboard cards.
                </p>
                <div className="notes-actions">
                  <Button
                    disabled={
                      locked ||
                      !note.canEdit ||
                      !draft.title.trim() ||
                      draft.content.length > 16000
                    }
                    onClick={() =>
                      mutate(
                        {
                          action: "save",
                          ...draft,
                          tags: tags
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        },
                        () => setEditing(false),
                      )
                    }
                  >
                    Save note
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !!pending}
                    onClick={() => {
                      setDraft(fields(note));
                      setTags(note.tags.join(", "));
                      setEditing(false);
                      setError("");
                    }}
                  >
                    Cancel editing
                  </Button>
                </div>
              </section>
            ) : (
              <section className="notes-prose">
                <TaskMarkdown
                  content={note.content || "_No written content yet._"}
                />
              </section>
            )}
            {note.tags.length > 0 && (
              <div className="notes-tags">
                {note.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            )}
            {note.mode === "moodboard" && (
              <section
                className="notes-board"
                aria-labelledby="notes-board-title"
              >
                <div className="notes-section-heading">
                  <h2 id="notes-board-title">Your board</h2>
                  {note.canEdit && (
                    <Button
                      disabled={locked || dirty}
                      onClick={() => openCard()}
                    >
                      <Plus size={17} />
                      Add card
                    </Button>
                  )}
                </div>
                <div className="notes-board-grid">
                  {note.cards.map((card, index) => (
                    <article
                      className={`notes-board-card notes-board-${card.body.kind}`}
                      key={card.id}
                    >
                      {card.body.kind === "text" ? (
                        <>
                          <h3>{card.body.title || "A thought"}</h3>
                          <TaskMarkdown content={card.body.text} />
                        </>
                      ) : card.body.kind === "image" ? (
                        <>
                          {card.imagePath && (
                            <img
                              src={card.imagePath}
                              alt={
                                card.body.caption || "Private moodboard image"
                              }
                            />
                          )}
                          <p>{card.body.caption}</p>
                        </>
                      ) : card.body.kind === "link" ? (
                        <a
                          href={card.body.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={20} />
                          <h3>{card.body.title}</h3>
                          <p>{new URL(card.body.url).hostname}</p>
                        </a>
                      ) : card.target ? (
                        <a href={card.target.path}>
                          <FileText size={20} />
                          <h3>{card.target.title}</h3>
                          <p>Linked note</p>
                        </a>
                      ) : (
                        <p>Linked note unavailable. Its access is separate.</p>
                      )}
                      {note.canEdit && (
                        <div className="notes-card-controls">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Move card ${index + 1} up`}
                            disabled={locked || dirty || index === 0}
                            onClick={() =>
                              mutate({
                                action: "reorder_cards",
                                cardIds: moveNoteCard(
                                  note.cards.map((c) => c.id),
                                  card.id,
                                  -1,
                                ),
                              })
                            }
                          >
                            <ChevronUp size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Move card ${index + 1} down`}
                            disabled={
                              locked || dirty || index === note.cards.length - 1
                            }
                            onClick={() =>
                              mutate({
                                action: "reorder_cards",
                                cardIds: moveNoteCard(
                                  note.cards.map((c) => c.id),
                                  card.id,
                                  1,
                                ),
                              })
                            }
                          >
                            <ChevronDown size={16} />
                          </Button>
                          {card.body.kind !== "note" &&
                            card.body.kind !== "image" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={locked || dirty}
                                onClick={() => openCard(card)}
                              >
                                Edit
                              </Button>
                            )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove card ${index + 1}`}
                            disabled={locked || dirty}
                            onClick={() =>
                              mutate({ action: "remove_card", cardId: card.id })
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {!note.cards.length && (
                  <p className="notes-muted">
                    Collect text, private images, links and other notes. Cards
                    keep the order you choose.
                  </p>
                )}
              </section>
            )}
            <section className="notes-connections">
              <div>
                <div className="notes-section-heading">
                  <h2>Linked notes</h2>
                  {note.canEdit && (
                    <Button
                      variant="outline"
                      disabled={locked || dirty}
                      onClick={() => {
                        setLinkTarget("");
                        setLinkSearch("");
                        setModal("link");
                      }}
                    >
                      <Link2 size={16} />
                      Link note
                    </Button>
                  )}
                </div>
                {note.links.map((link) => (
                  <div className="notes-reference" key={link.id}>
                    <a href={link.path}>{link.title}</a>
                    {note.canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Unlink ${link.title}`}
                        disabled={locked || dirty}
                        onClick={() =>
                          mutate({ action: "unlink", targetId: link.id })
                        }
                      >
                        <X size={15} />
                      </Button>
                    )}
                  </div>
                ))}
                {!note.links.length && (
                  <p className="notes-muted">
                    Connect an idea to another note. Access stays separate.
                  </p>
                )}
              </div>
              <div>
                <h2>Linked from</h2>
                {note.backlinks.map((link) => (
                  <a className="notes-reference" key={link.id} href={link.path}>
                    {link.title}
                  </a>
                ))}
                {!note.backlinks.length && (
                  <p className="notes-muted">
                    Notes linking here will appear when you can access them.
                  </p>
                )}
              </div>
            </section>
            {createdTask && (
              <p className="notes-feedback" role="status">
                Created Todo task:{" "}
                <a href={createdTask.path}>{createdTask.title}</a>
              </p>
            )}
            {note.tasks.length > 0 && (
              <section>
                <h2>Todo references</h2>
                {note.tasks.map((task) => (
                  <a className="notes-reference" key={task.id} href={task.path}>
                    {task.title}
                  </a>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      {modal && (
        <Modal
          title={
            modal === "create"
              ? "New note"
              : modal === "share"
                ? "Share note"
                : modal === "link"
                  ? "Link another note"
                  : modal === "card"
                    ? editingCard
                      ? "Edit card"
                      : "Add a card"
                    : modal === "trash"
                      ? "Move note to trash?"
                      : "Create a Todo task"
          }
          busy={busy || !!pending}
          onClose={() => setModal(null)}
        >
          {error && (
            <div role="alert" className="notes-alert">
              <p>{error}</p>
              {pending && (
                <Button
                  disabled={busy}
                  onClick={() => void send(pending, pendingAck.current)}
                >
                  Retry same request
                </Button>
              )}
            </div>
          )}
          {modal === "create" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(
                  {
                    path: "/api/v1/notes",
                    method: "POST",
                    body: {
                      title: newTitle,
                      content: "",
                      tags: [],
                      mode: newMode,
                      theme: settings.settings.defaultTheme,
                      operationId: crypto.randomUUID(),
                    },
                  },
                  (value) => {
                    setModal(null);
                    runtime.navigate(notePath(value.id));
                  },
                );
              }}
            >
              <p>Only you can see it until you choose to share.</p>
              <label>
                Title
                <Input
                  autoFocus
                  aria-label="New note title"
                  value={newTitle}
                  maxLength={300}
                  required
                  disabled={locked}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>
              <label>
                Format
                <NativeSelect
                  aria-label="New note format"
                  value={newMode}
                  disabled={locked}
                  onChange={(e) =>
                    setNewMode(e.target.value as "note" | "moodboard")
                  }
                >
                  <option value="note">Note</option>
                  <option value="moodboard">Moodboard</option>
                </NativeSelect>
              </label>
              <Button type="submit" disabled={locked || !newTitle.trim()}>
                Create note
              </Button>
            </form>
          )}
          {modal === "share" && note && (
            <>
              <p>
                Grant an existing Wuff account access to this note. Linked notes
                and Todo lists keep their own access.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(
                    {
                      action: "share",
                      email,
                      role: role as "viewer" | "editor",
                    },
                    () => setEmail(""),
                  );
                }}
              >
                <label>
                  Account email
                  <Input
                    type="email"
                    aria-label="Share with email"
                    value={email}
                    required
                    disabled={locked}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Access
                  <NativeSelect
                    aria-label="Sharing access"
                    value={role}
                    disabled={locked}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="viewer">Viewer — read only</option>
                    <option value="editor">
                      Editor — edit content and board
                    </option>
                  </NativeSelect>
                </label>
                <Button type="submit" disabled={locked || !email}>
                  Grant access
                </Button>
              </form>
              <h3>People with access</h3>
              <p>{note.ownerName} · Owner</p>
              {note.members?.map((member) => (
                <div className="notes-reference" key={member.userId}>
                  <span>
                    {member.name} · {member.role}
                  </span>
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() =>
                      mutate({ action: "unshare", userId: member.userId })
                    }
                  >
                    Remove {member.name}
                  </Button>
                </div>
              ))}
            </>
          )}
          {(modal === "link" || (modal === "card" && cardKind === "note")) && (
            <>
              <label>
                Find a note
                <Input
                  aria-label="Find a note to link"
                  value={linkSearch}
                  disabled={locked}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
              </label>
              <label>
                Note
                <NativeSelect
                  aria-label="Linked note"
                  value={linkTarget}
                  disabled={locked}
                  onChange={(e) => setLinkTarget(e.target.value)}
                >
                  <option value="">Choose a note</option>
                  {linkChoices
                    .filter((n) => n.id !== note?.id)
                    .map((n) => (
                      <option value={n.id} key={n.id}>
                        {n.title}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <Button
                disabled={locked || !linkTarget}
                onClick={() =>
                  modal === "link"
                    ? mutate({ action: "link", targetId: linkTarget }, () =>
                        setModal(null),
                      )
                    : addCard({ kind: "note", targetId: linkTarget })
                }
              >
                {modal === "link" ? "Link note" : "Add linked note card"}
              </Button>
            </>
          )}
          {modal === "card" && note && (
            <>
              <label>
                Card type
                <NativeSelect
                  aria-label="Card type"
                  value={cardKind}
                  disabled={locked || !!editingCard}
                  onChange={(e) =>
                    setCardKind(e.target.value as BoardBody["kind"])
                  }
                >
                  <option value="text">Text</option>
                  <option value="image">Private image</option>
                  <option value="link">Web link</option>
                  <option value="note">Linked note</option>
                </NativeSelect>
              </label>
              {cardKind === "text" && (
                <>
                  <label>
                    Heading
                    <Input
                      aria-label="Card heading"
                      value={cardTitle}
                      maxLength={160}
                      disabled={locked}
                      onChange={(e) => setCardTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Text
                    <textarea
                      aria-label="Card text"
                      value={cardText}
                      maxLength={8000}
                      disabled={locked}
                      onChange={(e) => setCardText(e.target.value)}
                    />
                  </label>
                  <Button
                    disabled={locked || !cardText.trim()}
                    onClick={() =>
                      addCard({
                        kind: "text",
                        title: cardTitle,
                        text: cardText,
                      })
                    }
                  >
                    {editingCard ? "Save card" : "Add text card"}
                  </Button>
                </>
              )}
              {cardKind === "link" && (
                <>
                  <label>
                    Title
                    <Input
                      aria-label="Link card title"
                      value={cardTitle}
                      maxLength={160}
                      disabled={locked}
                      onChange={(e) => setCardTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Address
                    <Input
                      type="url"
                      aria-label="Link card address"
                      value={cardUrl}
                      disabled={locked}
                      onChange={(e) => setCardUrl(e.target.value)}
                    />
                  </label>
                  <p className="notes-muted">
                    Only the address and title you enter are saved. No website
                    preview is fetched.
                  </p>
                  <Button
                    disabled={locked || !cardTitle || !cardUrl}
                    onClick={() =>
                      addCard({ kind: "link", title: cardTitle, url: cardUrl })
                    }
                  >
                    {editingCard ? "Save card" : "Add link card"}
                  </Button>
                </>
              )}
              {cardKind === "image" && (
                <>
                  <label>
                    Upload a private image
                    <input
                      type="file"
                      aria-label="Upload board image"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={locked}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void upload(file);
                      }}
                    />
                  </label>
                  <label>
                    Image description
                    <Input
                      aria-label="Board image description"
                      value={cardText}
                      maxLength={300}
                      disabled={locked}
                      onChange={(e) => setCardText(e.target.value)}
                    />
                  </label>
                  <p className="notes-muted">
                    Still PNG, JPEG or WebP, up to 3 MiB. Metadata is removed.
                    Choose an uploaded image to add it to the board.
                  </p>
                  <div className="notes-asset-grid">
                    {note.assets
                      .filter((a) => a.ready)
                      .map((asset, imageIndex) => (
                        <button
                          key={asset.id}
                          aria-label={`Add uploaded image ${imageIndex + 1}`}
                          disabled={locked}
                          onClick={() =>
                            addCard({
                              kind: "image",
                              assetId: asset.id,
                              caption: cardText,
                            })
                          }
                        >
                          <img src={asset.path} alt="Uploaded board image" />
                        </button>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
          {modal === "task" && note && (
            <>
              <p>
                The chosen Todo list has its own members and may use
                integrations. This creates a copy with a source link; it does
                not grant access to this note or copy private images or
                linked-note content.
              </p>
              <label>
                Task title
                <Input
                  aria-label="Todo task title"
                  value={taskTitle}
                  maxLength={300}
                  disabled={locked}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </label>
              <label>
                Destination list
                <NativeSelect
                  aria-label="Todo destination list"
                  value={listId}
                  disabled={locked}
                  onChange={(e) => setListId(e.target.value)}
                >
                  <option value="">Choose a list</option>
                  {listOptions
                    .filter((l) => !l.archived)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                        {l.shared ? " · Shared" : ""}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <Button
                variant="outline"
                disabled={locked}
                onClick={() => void loadLists()}
              >
                Load latest lists
              </Button>
              <label className="notes-checkbox">
                <input
                  type="checkbox"
                  checked={copyContent}
                  disabled={locked}
                  onChange={(e) => setCopyContent(e.target.checked)}
                />
                Also copy the note's written content
              </label>
              <label className="notes-checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={locked}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I understand the chosen list's members and integrations may see
                the copied text.
              </label>
              <Button
                disabled={locked || !listId || !taskTitle.trim() || !confirmed}
                onClick={() => {
                  const list = listOptions.find((l) => l.id === listId);
                  if (!list) return;
                  void send(
                    {
                      path: "/api/v1/notes/export",
                      method: "POST",
                      body: {
                        noteId: note.id,
                        version: note.version,
                        listId,
                        listVersion: list.version,
                        title: taskTitle,
                        includeContent: copyContent,
                        confirmed: true,
                        operationId: crypto.randomUUID(),
                      },
                    },
                    (value) => {
                      accept(value.note);
                      setCreatedTask(value.task);
                      setModal(null);
                    },
                  );
                }}
              >
                Create Todo task
              </Button>
            </>
          )}
          {modal === "trash" && (
            <>
              <p>
                This hides the note from everyone with access. You can restore
                it from Trash; its content and private images are retained.
              </p>
              <Button
                disabled={locked}
                onClick={() =>
                  mutate({ action: "trash" }, () => setModal(null))
                }
              >
                Move to trash
              </Button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
