"use client";
import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
export function SortableList({
  items,
  disabled,
  onReorder,
  children,
}: {
  items: { id: string; title: string }[];
  disabled: boolean;
  onReorder: (ids: string[], before: string[]) => Promise<unknown>;
  children: ReactNode;
}) {
  const id = useId(),
    started = useRef<string[]>([]),
    [dragged, setDragged] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const ids = items.map((i) => i.id),
    name = (id: string | number) =>
      items.find((i) => i.id === id)?.title ?? "item";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Space to pick up. Use the arrow keys to move, Space to drop, or Escape to cancel.",
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${name(active.id)} at position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.`
              : undefined,
          onDragEnd: ({ active, over }) =>
            over ? `Dropped ${name(active.id)}.` : "Reordering cancelled.",
          onDragCancel: () => "Reordering cancelled.",
        },
      }}
      onDragStart={({ active }) => {
        started.current = [...ids];
        setDragged(String(active.id));
      }}
      onDragCancel={() => setDragged(null)}
      onDragEnd={({ active, over }) => {
        setDragged(null);
        if (disabled || !over || active.id === over.id) return;
        if (started.current.join() !== ids.join()) {
          setNotice(
            "Your pack changed while dragging. Try moving the item again.",
          );
          return;
        }
        const from = ids.indexOf(String(active.id)),
          to = ids.indexOf(String(over.id));
        if (from >= 0 && to >= 0) {
          setNotice("Saving order…");
          void onReorder(arrayMove(ids, from, to), ids)
            .then((saved) => {
              setNotice(
                saved === false
                  ? "Ruff patch! Order wasn’t saved. Check the message above."
                  : "Paw-some, order saved.",
              );
            })
            .catch(() =>
              setNotice("Ruff patch! Order wasn’t saved. Try again."),
            )
            .finally(() => {
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLButtonElement>(
                    `[data-sort-id="${CSS.escape(String(active.id))}"]`,
                  )
                  ?.focus(),
              );
            });
        }
      }}
    >
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        {children}
      </SortableContext>
      <p role="status" className="sr-only">
        {notice}
      </p>
      <DragOverlay dropAnimation={null}>
        {dragged ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-white px-4 py-3 shadow-lg max-w-sm">
            <GripVertical size={16} className="text-slate-400" />
            <span className="truncate">{name(dragged)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
export function SortableItem({
  id,
  title,
  disabled,
  children,
}: {
  id: string;
  title: string;
  disabled: boolean;
  children: (props: {
    ref: (node: HTMLElement | null) => void;
    style: CSSProperties;
    handle: ReactNode;
  }) => ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const handle = (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      data-sort-id={id}
      aria-label={`Reorder ${title}`}
      className="drag-handle h-8 w-8 shrink-0 touch-none text-slate-400 hover:text-primary cursor-grab active:cursor-grabbing"
      title="Drag to reorder · Space for keyboard"
    >
      <GripVertical size={16} />
    </Button>
  );
  return children({
    ref: setNodeRef,
    style: {
      transform: DndCSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : undefined,
      position: "relative",
      zIndex: isDragging ? 1 : undefined,
    },
    handle,
  });
}
