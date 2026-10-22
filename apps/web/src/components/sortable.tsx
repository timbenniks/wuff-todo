"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
  type Modifier,
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
  nodes: { current: Map<string, HTMLElement> };
  dragging: { current: boolean };
  suppressClickUntil: { current: number };
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
export function SortableList<T extends { id: string; title: string }>({
  items,
  disabled,
  onReorder,
  children,
}: {
  items: T[];
  disabled: boolean;
  onReorder: (ids: string[], before: string[]) => Promise<unknown>;
  children: ReactNode | ((items: T[]) => ReactNode);
}) {
  const id = useId(),
    started = useRef<string[]>([]),
    [dragged, setDragged] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const nodes = useRef(new Map<string, HTMLElement>());
  const boundary = useRef<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{
    html: string;
    width: number;
    height: number;
  } | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{
    before: string[];
    after: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const rowList = typeof children === "function";
  const sourceIds = items.map((item) => item.id);
  // A refreshed membership or a different authoritative order supersedes a local projection.
  const projected =
    pendingOrder && sourceIds.join() === pendingOrder.before.join()
      ? pendingOrder.after.map((id) => items.find((item) => item.id === id)!)
      : items;
  const persistOrder = async (next: string[], before: string[]) => {
    if (rowList) setPendingOrder({ before, after: next });
    setSaving(true);
    try {
      return await onReorder(next, before);
    } finally {
      setPendingOrder(null);
      setSaving(false);
    }
  };
  const restrictToList: Modifier = ({ transform, draggingNodeRect }) => {
    const bounds = boundary.current?.getBoundingClientRect();
    if (!bounds || !draggingNodeRect) return { ...transform, x: 0 };
    const min = bounds.top - draggingNodeRect.top;
    const max = bounds.bottom - draggingNodeRect.bottom;
    return { ...transform, x: 0, y: Math.max(min, Math.min(max, transform.y)) };
  };
  const dragging = useRef(false);
  const suppressClickUntil = useRef(0);
  const ids = projected.map((i) => i.id),
    name = (id: string | number) =>
      items.find((i) => i.id === id)?.title ?? "item";
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <MoveContext.Provider
      value={{
        items: projected,
        nodes,
        dragging,
        suppressClickUntil,
        move: async (id, position) => {
          const from = ids.indexOf(id);
          if (
            disabled ||
            saving ||
            from < 0 ||
            position < 0 ||
            position >= ids.length
          )
            return false;
          if (from === position) return true;
          setNotice("Saving order…");
          try {
            const saved = await persistOrder(
              arrayMove(ids, from, position),
              ids,
            );
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
        modifiers={rowList ? [restrictToList] : undefined}
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
          const node = nodes.current.get(String(active.id));
          boundary.current = node?.parentElement ?? null;
          if (rowList && node) {
            const rect = node.getBoundingClientRect();
            const clone = node.cloneNode(true) as HTMLElement;
            const computed = getComputedStyle(node);
            for (const element of [
              clone,
              ...clone.querySelectorAll<HTMLElement>("*"),
            ]) {
              for (const attr of [
                "id",
                "data-sort-id",
                "data-task-id",
                "aria-describedby",
                "aria-controls",
                "autofocus",
              ])
                element.removeAttribute(attr);
              element.removeAttribute("tabindex");
            }
            Object.assign(clone.style, {
              transform: "none",
              transition: "none",
              opacity: "1",
              width: "100%",
              height: `${rect.height}px`,
              boxSizing: "border-box",
              borderTopWidth: computed.borderTopWidth,
              borderTopStyle: computed.borderTopStyle,
              borderTopColor: computed.borderTopColor,
            });
            setPreview({
              html: clone.outerHTML,
              width: rect.width,
              height: rect.height,
            });
          }
          started.current = [...ids];
          setDragged(String(active.id));
        }}
        onDragCancel={() => {
          suppressClickUntil.current = Date.now() + 300;
          setDragged(null);
          setTimeout(() => {
            dragging.current = false;
          }, 0);
        }}
        onDragEnd={({ active, over }) => {
          suppressClickUntil.current = Date.now() + 300;
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
            void persistOrder(arrayMove(ids, from, to), ids)
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
          disabled={disabled || saving}
        >
          {typeof children === "function" ? children(projected) : children}
        </SortableContext>
        <p role="status" className="sr-only">
          {notice}
        </p>
        <DragOverlay dropAnimation={null}>
          {dragged && preview ? (
            <ul
              aria-hidden="true"
              inert
              className="task-drag-preview"
              style={{ width: preview.width, height: preview.height }}
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : dragged ? (
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
  entireRow = false,
  children,
}: {
  id: string;
  title: string;
  disabled: boolean;
  entireRow?: boolean;
  children: (props: {
    ref: (node: HTMLElement | null) => void;
    style: CSSProperties;
    handle: ReactNode;
    rowProps?: HTMLAttributes<HTMLElement> & {
      "data-sort-id"?: string;
      "data-row-draggable"?: boolean;
    };
    moveControl?: ReactNode;
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
  } = useSortable({
    id,
    disabled,
    animateLayoutChanges: entireRow ? () => false : undefined,
  });
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
    ref: (node) => {
      setNodeRef(node);
      if (node) moveContext?.nodes.current.set(id, node);
      else moveContext?.nodes.current.delete(id);
      if (entireRow) setActivatorNodeRef(node);
    },
    rowProps: entireRow
      ? {
          tabIndex: disabled ? undefined : 0,
          "aria-describedby": attributes["aria-describedby"],
          "aria-roledescription": disabled ? undefined : "sortable task",
          "data-sort-id": id,
          "data-row-draggable": !disabled || undefined,
          onMouseDown: (event) => {
            if (!disabled && rowDragTarget(event.target, event.currentTarget))
              listeners?.onMouseDown?.(event);
          },
          onTouchStart: (event) => {
            if (!disabled && rowDragTarget(event.target, event.currentTarget))
              listeners?.onTouchStart?.(event);
          },
          onKeyDown: (event) => {
            if (
              !disabled &&
              event.target === event.currentTarget &&
              event.code === "Space"
            )
              listeners?.onKeyDown?.(event);
          },
          onClickCapture: (event) => {
            if (
              moveContext?.dragging.current ||
              Date.now() < (moveContext?.suppressClickUntil.current ?? 0)
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
        }
      : undefined,
    moveControl:
      entireRow && !disabled ? (
        <>
          <Button type="button" variant="ghost" onClick={() => setMoving(true)}>
            <GripVertical size={16} /> Move to position
          </Button>
          {moving && <MoveDialog id={id} title={title} close={closeMove} />}
        </>
      ) : undefined,
    style: {
      transform: DndCSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? (entireRow ? 0 : 0.3) : undefined,
      position: "relative",
      zIndex: isDragging ? 1 : undefined,
    },
    handle,
  });
}

// Only the summary surface starts a row drag. Nested editors and controls retain
// their own gestures, including controls in expanded subtasks and popovers.
function rowDragTarget(target: EventTarget, row: HTMLElement) {
  if (!(target instanceof Element) || target.closest(".task-row") !== row)
    return false;
  const panel = target.closest(
    ".task-panel, .task-subtask-panel, .task-summary, .task-metadata",
  );
  if (panel && row.contains(panel)) return false;
  const control = target.closest(
    "button, a, input, textarea, select, summary, [contenteditable], [role=button], [role=checkbox]",
  );
  return !control || control.matches(".task-name > span > a");
}
