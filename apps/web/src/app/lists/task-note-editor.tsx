"use client";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo2,
  Redo2,
  Link2,
  Unlink,
  ImagePlus,
  Trash2,
} from "lucide-react";
import {
  needsPreservedNote,
  renderTaskMarkdown,
  safeNoteLink,
} from "@/lib/task-markdown";
import { PreservedNote, preservedNoteDocument } from "@/lib/preserved-note";
import { Button } from "@/components/ui/button";
import { TaskImageNode } from "@/lib/task-image-node";
import { useEffect, useState, useRef } from "react";

export default function TaskNoteEditor({
  value,
  onChange,
  disabled,
  onUpload,
}: {
  value: string;
  onChange: (content: string) => void;
  disabled: boolean;
  onUpload: (file: File) => Promise<string>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRef = useRef(onUpload);
  uploadRef.current = onUpload;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  async function insertImage(file: File) {
    if (disabledRef.current || !editor) return;
    try {
      const src = await uploadRef.current(file);
      if (!editor.isDestroyed)
        editor
          .chain()
          .focus()
          .insertContent({
            type: "taskImage",
            attrs: { src, alt: "Task image" },
          })
          .run();
    } catch {
      /* The parent keeps the error beside Save. */
    }
  }
  const [linking, setLinking] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [preserved, setPreserved] = useState(needsPreservedNote(value));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        underline: false,
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: false,
          isAllowedUri: safeNoteLink,
        },
      }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      PreservedNote,
      TaskImageNode,
      Markdown,
    ],
    content: needsPreservedNote(value) ? preservedNoteDocument(value) : value,
    contentType: needsPreservedNote(value) ? "json" : "markdown",
    editable: !disabled,
    editorProps: {
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        if (files[0]) void insertImage(files[0]);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (position) editor?.commands.setTextSelection(position.pos);
        void insertImage(event.dataTransfer.files[0]);
        return true;
      },
      attributes: {
        class: "task-prose task-editor",
        role: "textbox",
        "aria-label": "Task notes",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onCreate: ({ editor }) => {
      // A note created by an AI may use syntax outside our editor schema. Keep
      // the original Markdown rather than silently dropping unsupported data.
      if (
        renderTaskMarkdown(value).trim() !==
        renderTaskMarkdown(editor.getMarkdown()).trim()
      ) {
        editor.commands.setContent(preservedNoteDocument(value), {
          emitUpdate: false,
        });
        setPreserved(true);
      }
      editor.commands.focus("end");
    },
  });
  // Re-render toolbar state without replacing the draft during live list refreshes.
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            image: editor.isActive("taskImage"),
            alt: editor.getAttributes("taskImage").alt as string | undefined,
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            heading: editor.isActive("heading"),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
            code: editor.isActive("codeBlock"),
            link: editor.isActive("link"),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
          }
        : null,
  });
  // setEditable does not replace content or the selection.
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  if (!editor)
    return (
      <p role="status" className="p-4 text-sm">
        Fetching your writing paws…
      </p>
    );
  const controls = [
    [
      "Bold",
      Bold,
      state?.bold,
      () => editor.chain().focus().toggleBold().run(),
    ],
    [
      "Italic",
      Italic,
      state?.italic,
      () => editor.chain().focus().toggleItalic().run(),
    ],
    [
      "Strikethrough",
      Strikethrough,
      state?.strike,
      () => editor.chain().focus().toggleStrike().run(),
    ],
    [
      "Heading",
      Heading2,
      state?.heading,
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    [
      "Bullet list",
      List,
      state?.bullet,
      () => editor.chain().focus().toggleBulletList().run(),
    ],
    [
      "Numbered list",
      ListOrdered,
      state?.ordered,
      () => editor.chain().focus().toggleOrderedList().run(),
    ],
    [
      "Quote",
      Quote,
      state?.quote,
      () => editor.chain().focus().toggleBlockquote().run(),
    ],
    [
      "Code block",
      Code,
      state?.code,
      () => editor.chain().focus().toggleCodeBlock().run(),
    ],
    [
      "Add link",
      Link2,
      state?.link,
      () => {
        setUrl(editor.getAttributes("link").href ?? "");
        setLinking(true);
      },
    ],
  ] as const;
  return (
    <div className="overflow-hidden bg-white">
      <div
        role="group"
        aria-label="Text formatting"
        className="flex flex-wrap gap-0.5 border-b border-border bg-background p-1.5"
      >
        {controls.map(([label, Icon, active, run]) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon"
            title={label}
            aria-label={label}
            aria-pressed={!!active}
            disabled={disabled}
            className={active ? "bg-accent" : ""}
            onClick={run}
          >
            <Icon size={16} />
          </Button>
        ))}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label="Choose task image"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void insertImage(file);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Add image"
          aria-label="Add image"
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Remove link"
          aria-label="Remove link"
          disabled={disabled || !state?.link}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Unlink size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Undo"
          aria-label="Undo"
          disabled={disabled || !state?.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Redo"
          aria-label="Redo"
          disabled={disabled || !state?.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </Button>
      </div>
      {state?.image && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border p-3">
          <label className="grid flex-1 min-w-0 gap-1 text-xs font-semibold text-slate-500">
            Image description
            <input
              value={state.alt ?? ""}
              maxLength={300}
              disabled={disabled}
              onChange={(event) =>
                editor.commands.updateAttributes("taskImage", {
                  alt: event.target.value,
                })
              }
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => editor.chain().focus().deleteSelection().run()}
          >
            <Trash2 size={14} /> Remove image
          </Button>
        </div>
      )}
      {linking && (
        <div className="border-b border-border p-3 grid gap-2">
          <label className="text-xs font-semibold">
            Link address
            <input
              className="mt-1 w-full"
              aria-label="Link address"
              placeholder="https://example.com"
              value={url}
              disabled={disabled}
              autoFocus
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-red-800">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => {
                if (!safeNoteLink(url.trim())) {
                  setError(
                    "Ruff link! Use a full https://, http:// or mailto: address.",
                  );
                  return;
                }
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: url.trim() })
                  .run();
                setLinking(false);
              }}
            >
              Add link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setLinking(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {preserved && (
        <p role="status" className="px-4 pt-3 text-xs text-slate-500">
          Your original de-tails are kept intact below. Add to them, or select
          the saved block to replace it.
        </p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
