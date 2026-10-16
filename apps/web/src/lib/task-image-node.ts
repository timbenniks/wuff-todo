import { Node } from "@tiptap/core";
import { taskImageId } from "@wuff/contracts";

export const TaskImageNode = Node.create({
  name: "taskImage",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: "" },
    alt: { default: "Task image" },
  }),
  parseHTML: () => [
    {
      tag: "img[src]",
      getAttrs: (element) => {
        const src = (element as HTMLElement).getAttribute("src") ?? "";
        return taskImageId(src)
          ? {
              src,
              alt: (element as HTMLElement).getAttribute("alt") ?? "Task image",
            }
          : false;
      },
    },
  ],
  renderHTML: ({ HTMLAttributes }) =>
    taskImageId(HTMLAttributes.src ?? "")
      ? [
          "img",
          {
            src: HTMLAttributes.src,
            alt: HTMLAttributes.alt || "Task image",
            loading: "lazy",
            decoding: "async",
          },
        ]
      : ["span", {}, "Ruff luck! Image unavailable."],
  markdownTokenName: "image",
  parseMarkdown: (token, helpers) =>
    taskImageId(token.href ?? "")
      ? helpers.createNode("taskImage", {
          src: token.href,
          alt: token.text || "Task image",
        })
      : helpers.createTextNode("[External image not loaded]"),
  renderMarkdown: (node) =>
    taskImageId(node.attrs?.src ?? "")
      ? `![${String(node.attrs?.alt ?? "Task image")
          .replace(/[\\\[\]]/g, "\\$&")
          .replace(/[\r\n]/g, " ")}](${node.attrs!.src})`
      : "[Image unavailable]",
});
