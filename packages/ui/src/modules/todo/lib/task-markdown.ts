import { taskImageId, taskImagePath } from "@wuff/contracts";
import MarkdownIt from "markdown-it";
import { wuffCopy } from "../../../features/lib/copy";

// One renderer for the website and the sandboxed MCP App. Keep HTML disabled;
// never load a remote image merely because an AI/client supplied Markdown.
export function safeNoteLink(value: string) {
  return (
    /^(https?:\/\/|mailto:)/i.test(value) &&
    !/[\u0000-\u0020\u007f]/.test(value)
  );
}
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });
markdown.validateLink = (value) => safeNoteLink(value) || !!taskImageId(value);
// Render Markdown checklists as decorative checked/unchecked boxes. These are
// note content, not Wuff subtasks, and never send completion mutations.
markdown.core.ruler.after("inline", "note_checklists", (state) => {
  for (let i = 2; i < state.tokens.length; i++) {
    const token = state.tokens[i];
    if (
      token.type !== "inline" ||
      state.tokens[i - 2].type !== "list_item_open"
    )
      continue;
    const first = token.children?.[0];
    const match =
      first?.type === "text" && first.content.match(/^\[([ xX])\] /);
    if (!match || !first) continue;
    first.content = first.content.slice(4);
    const box = new state.Token("html_inline", "", 0);
    box.content =
      match[1] === " "
        ? '<span aria-label="Unchecked">☐</span> '
        : '<span aria-label="Checked">☑</span> ';
    token.children!.unshift(box);
  }
});
const defaultLink = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noopener noreferrer");
  return defaultLink
    ? defaultLink(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};
type ImageEnvironment = { imageSource?: (id: string) => string | null };
markdown.renderer.rules.image = (tokens, index, _options, env) => {
  const token = tokens[index],
    id = taskImageId(String(token.attrGet("src") ?? "")),
    alt = markdown.utils.escapeHtml(token.content || "Task image");
  if (!id)
    return `<span class="note-image">[Image: ${alt} — paws off: external image not loaded]</span>`;
  const imageEnv = env as ImageEnvironment | undefined;
  const src = imageEnv?.imageSource
    ? imageEnv.imageSource(id)
    : taskImagePath(id);
  return src
    ? `<img src="${markdown.utils.escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async">`
    : `<span class="note-image" data-task-image="${id}" aria-label="${alt}" role="status">${wuffCopy.fetchingImage}</span>`;
};
export function renderTaskMarkdown(
  content: string,
  env: ImageEnvironment = {},
) {
  return markdown.render(content, env);
}

// Keep raw HTML, image syntax and extended blocks out of Tiptap's HTML import
// path altogether. They remain literal/non-loading in the Markdown renderer.
const inspection = new MarkdownIt({ html: true }); // tokenize only; never render
export function needsPreservedNote(content: string) {
  const unsafe = (tokens: ReturnType<typeof inspection.parse>): boolean =>
    tokens.some(
      (token) =>
        ["html_block", "html_inline"].includes(token.type) ||
        (token.type === "image" &&
          !taskImageId(String(token.attrGet("src") ?? ""))) ||
        (token.children ? unsafe(token.children) : false),
    );
  return (
    unsafe(inspection.parse(content, {})) ||
    /^ {0,3}(?:\[\^[^\]]+\]:|:::)/m.test(content)
  );
}
