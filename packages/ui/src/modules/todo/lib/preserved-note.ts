import { Node } from "@tiptap/core";
import { renderTaskMarkdown } from "./task-markdown";
// Keep syntax outside the visual editor's schema as a rendered, selectable
// block. It can be retained, moved or deliberately deleted without executing
// HTML, fetching images, or silently discarding the original Markdown.
export const PreservedNote = Node.create({
  name: "preservedNote",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes: () => ({ content: { default: "" } }),
  parseHTML: () => [],
  renderHTML: () => ["div", { "data-preserved-note": "true" }, "Saved content"],
  renderMarkdown: (node) => node.attrs?.content ?? "",
  addNodeView:
    () =>
    ({ node }) => {
      const dom = document.createElement("div");
      dom.contentEditable = "false";
      dom.className = "preserved-note task-prose";
      dom.setAttribute("aria-label", "Saved content, kept intact");
      dom.innerHTML = renderTaskMarkdown(node.attrs.content);
      return { dom, ignoreMutation: () => true };
    },
});
export function preservedNoteDocument(content: string) {
  return {
    type: "doc",
    content: [
      { type: "preservedNote", attrs: { content } },
      { type: "paragraph" },
    ],
  };
}
