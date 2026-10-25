import MarkdownIt from "markdown-it";
import { taskImageId } from "@wuff/contracts";
const parser = new MarkdownIt({ html: false });
export function taskImageReferences(content: string): string[] {
  const ids = new Set<string>();
  const visit = (tokens: ReturnType<typeof parser.parse>) => {
    for (const token of tokens) {
      if (token.type === "image") {
        const id = taskImageId(String(token.attrGet("src") ?? ""));
        if (id) ids.add(id);
      }
      if (token.children) visit(token.children);
    }
  };
  visit(parser.parse(content, {}));
  return [...ids];
}
