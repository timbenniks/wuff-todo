"use client";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useContext, useEffect, useState } from "react";
import { taskImageId } from "@wuff/contracts";
import { RuntimeContext } from "../runtime";
export function TaskImageView({ node }: NodeViewProps) {
  const runtime = useContext(RuntimeContext),
    id = taskImageId(node.attrs.src ?? "");
  const [src, setSrc] = useState<string | null>(null),
    [failed, setFailed] = useState("");
  useEffect(() => {
    if (!runtime?.image || !id) return;
    let active = true,
      release: (() => void) | undefined;
    setSrc(null);
    setFailed("");
    void runtime
      .image(id)
      .then((resource) => {
        if (!active) {
          resource.release();
          return;
        }
        release = resource.release;
        setSrc(resource.url);
      })
      .catch((error) => {
        if (active)
          setFailed(
            error instanceof Error ? error.message : "Image unavailable",
          );
      });
    return () => {
      active = false;
      release?.();
    };
  }, [runtime, id]);
  const source = runtime?.image ? src : id ? node.attrs.src : null;
  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      {source ? (
        <img src={source} alt={node.attrs.alt || "Task image"} />
      ) : (
        <span role="status">{failed || "Fetching image…"}</span>
      )}
    </NodeViewWrapper>
  );
}
