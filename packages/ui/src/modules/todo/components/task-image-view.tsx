"use client";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { taskImageId } from "@wuff/contracts";
export function TaskImageView({ node }: NodeViewProps) {
  const source = taskImageId(node.attrs.src ?? "") ? node.attrs.src : null;
  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      {source ? (
        <img src={source} alt={node.attrs.alt || "Task image"} />
      ) : (
        <span role="status">Fetching image…</span>
      )}
    </NodeViewWrapper>
  );
}
