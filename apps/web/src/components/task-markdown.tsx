import { renderTaskMarkdown } from "@/lib/task-markdown";
export function TaskMarkdown({ content }: { content: string }) {
  return (
    <div
      className="task-prose"
      dangerouslySetInnerHTML={{ __html: renderTaskMarkdown(content) }}
    />
  );
}
