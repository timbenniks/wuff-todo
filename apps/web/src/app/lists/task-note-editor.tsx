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
} from "lucide-react";
import {
  needsPreservedNote,
  renderTaskMarkdown,
  safeNoteLink,
} from "@/lib/task-markdown";
import { PreservedNote, preservedNoteDocument } from "@/lib/preserved-note";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function TaskNoteEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (content: string) => void;
  disabled: boolean;
}) {
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
      Markdown,
    ],
    content: needsPreservedNote(value) ? preservedNoteDocument(value) : value,
    contentType: needsPreservedNote(value) ? "json" : "markdown",
    editable: !disabled,
    editorProps: {
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
