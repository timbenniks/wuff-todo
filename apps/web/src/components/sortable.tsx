"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
import { NativeSelect } from "./ui/native-select";

const MoveContext = createContext<{
  items: { id: string; title: string }[];
  dragging: { current: boolean };
  move: (id: string, position: number) => Promise<unknown>;
} | null>(null);

function MoveDialog({
  id,
  title,
  close,
}: {
  id: string;
  title: string;
  close: () => void;
}) {
  const context = useContext(MoveContext)!;
  const dialog = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState(
    context.items.findIndex((i) => i.id === id),
  );
  const initialOrder = useRef(context.items.map((i) => i.id).join());
  const changed =
    initialOrder.current !== context.items.map((i) => i.id).join();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      onClose={close}
      aria-label={`Move ${title}`}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-surface text-foreground p-5 shadow-xl backdrop:bg-slate-900/30"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
    >
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (changed || busy) return;
          setBusy(true);
          setError("");
          try {
            const saved = await context.move(id, position);
            if (saved !== false) close();
            else
              setError(
                "Order wasn’t saved. Check the list message and try again.",
              );
          } catch {
            setError("Order wasn’t saved. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg font-bold break-words">Move {title}</h2>
        <label className="grid gap-2 text-sm">
          Position
          <NativeSelect
            aria-label="Position"
            value={position}
            disabled={busy}
            onChange={(e) => setPosition(Number(e.target.value))}
          >
            {context.items.map((item, i) => (
              <option key={item.id} value={i}>
                {i + 1} · {item.title}
              </option>
            ))}
          </NativeSelect>
        </label>
        {changed && (
          <p role="status" className="text-sm text-muted-foreground">
            The order changed. Close and reopen this picker to use the latest
            order.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || changed}>
            {busy ? "Moving…" : "Move"}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
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
  const dragging = useRef(false);
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
    <MoveContext.Provider
      value={{
        items,
        dragging,
        move: async (id, position) => {
          const from = ids.indexOf(id);
          if (disabled || from < 0 || position < 0 || position >= ids.length)
            return false;
          if (from === position) return true;
          setNotice("Saving order…");
          try {
            const saved = await onReorder(arrayMove(ids, from, position), ids);
            setNotice(
              saved === false
                ? "Order wasn’t saved. Check the list message."
                : "Order saved.",
            );
            return saved;
          } catch (error) {
            setNotice("Order wasn’t saved. Try again.");
            throw error;
          }
        },
      }}
    >
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Lend a paw: press Space to pick up. Use the arrow keys to move, Space to drop, or Escape to cancel.",
          },
          announcements: {
            onDragStart: ({ active }) =>
              `Paws on ${name(active.id)}. Picked up.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${name(active.id)} at position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.`
                : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? `Paws off ${name(active.id)}. Dropped.`
                : "Paws off. Reordering cancelled.",
            onDragCancel: () => "Paws off. Reordering cancelled.",
          },
        }}
        onDragStart={({ active }) => {
          dragging.current = true;
          started.current = [...ids];
          setDragged(String(active.id));
        }}
        onDragCancel={() => {
          setDragged(null);
          setTimeout(() => {
            dragging.current = false;
          }, 0);
        }}
        onDragEnd={({ active, over }) => {
          setTimeout(() => {
            dragging.current = false;
          }, 0);
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
            setNotice("Getting your pack in order… Saving order.");
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
            <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-surface px-4 py-3 shadow-lg max-w-sm">
              <GripVertical size={16} className="text-muted-foreground" />
              <span className="truncate">{name(dragged)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </MoveContext.Provider>
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
  const moveContext = useContext(MoveContext);
  const [moving, setMoving] = useState(false);
  const closeMove = () => {
    setMoving(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-sort-id="${CSS.escape(id)}"]`)
        ?.focus(),
    );
  };
  const handle = (
    <>
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
        className="drag-handle h-11 w-11 shrink-0 touch-none text-muted-foreground hover:text-primary cursor-grab active:cursor-grabbing"
        title="Drag to reorder · Click for position · Space for keyboard"
        aria-haspopup="dialog"
        onClick={() => {
          if (!moveContext?.dragging.current) setMoving(true);
        }}
      >
        <GripVertical size={16} />
      </Button>
      {moving && <MoveDialog id={id} title={title} close={closeMove} />}
    </>
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
