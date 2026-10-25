"use client";
import {
  useEffect,
  useRef,
  useId,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { Button } from "@wuff/ui/button";
import { X } from "lucide-react";
import { containDialogFocus } from "../components/dialog-focus";
export const TotakeSaveContext = createContext({
  busy: false,
  uncertain: false,
  conflict: false,
  offline: false,
  retry: async () => {},
  loadLatest: async () => {},
});
let rootOpener: HTMLElement | null = null;
const focusable = (el: HTMLElement | null) =>
  !!el?.isConnected &&
  el.getClientRects().length > 0 &&
  !el.closest("dialog:not([open])");
export function Modal({
  title,
  children,
  onClose,
  className = "",
  dirty = false,
  open = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  dirty?: boolean;
  open?: boolean;
}) {
  const save = useContext(TotakeSaveContext);
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null),
    fallback = useRef<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState(false),
    pressedBackdrop = useRef(false),
    lastInside = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement as HTMLElement;
    trigger.current = active;
    fallback.current = rootOpener;
    if (
      active !== document.body &&
      !active.closest("dialog") &&
      active.matches("button,input,select,textarea,a[href],[tabindex]")
    ) {
      rootOpener = active;
      fallback.current = active;
    }
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      const target = focusable(trigger.current)
        ? trigger.current
        : focusable(fallback.current)
          ? fallback.current
          : null;
      if (target) target.focus();
      else document.querySelector<HTMLElement>("#page-title")?.focus();
    };
  }, [open]);
  const requestClose = () => {
    if (save.busy || save.uncertain) return;
    if (dirty) setConfirm(true);
    else onClose();
  };
  const isBackdrop = (target: EventTarget | null, x: number, y: number) => {
    const dialog = ref.current;
    if (!dialog || target !== dialog) return false;
    const r = dialog.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true;
    if (className.includes("full-screen-alert")) {
      const body = dialog
          .querySelector(".full-alert-body")
          ?.getBoundingClientRect(),
        header = dialog.querySelector("header")?.getBoundingClientRect();
      return (
        !!body &&
        y > (header?.bottom ?? 0) &&
        (x < body.left || x > body.right || y > body.bottom)
      );
    }
    return false;
  };
  const keep = () => {
    setConfirm(false);
    requestAnimationFrame(() => {
      if (lastInside.current?.isConnected) lastInside.current.focus();
      else
        (
          ref.current?.querySelector<HTMLElement>("input,select,textarea") ??
          ref.current?.querySelector<HTMLButtonElement>("button")
        )?.focus();
    });
  };
  return (
    <>
      <dialog
        ref={ref}
        className={className}
        aria-labelledby={titleId}
        onFocusCapture={(e) => {
          if (
            e.target !== ref.current &&
            e.target.closest("dialog") === ref.current
          )
            lastInside.current = e.target as HTMLElement;
        }}
        onPointerDown={(e) => {
          pressedBackdrop.current = isBackdrop(e.target, e.clientX, e.clientY);
        }}
        onClick={(e) => {
          if (
            pressedBackdrop.current &&
            isBackdrop(e.target, e.clientX, e.clientY)
          )
            requestClose();
          pressedBackdrop.current = false;
        }}
        onCancel={(e) => {
          if (e.target !== ref.current) return;
          e.preventDefault();
          requestClose();
        }}
        onKeyDown={containDialogFocus}
      >
        <header className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Close ${title}`}
            onClick={requestClose}
          >
            <X size={20} />
          </Button>
        </header>
        {save.busy && <p role="status">Saving…</p>}
        {save.uncertain && (
          <div role="alert">
            <p>This save is unconfirmed. Retry the same request.</p>
            <Button disabled={save.busy} onClick={save.retry}>
              Retry the same save
            </Button>
          </div>
        )}
        {save.offline && (
          <div role="alert">
            <p>Totake could not refresh. Your draft is kept.</p>
            <Button onClick={save.loadLatest}>Load latest data</Button>
          </div>
        )}
        {save.conflict && (
          <div role="alert">
            <p>Totake changed. Your draft is kept.</p>
            <Button onClick={save.loadLatest}>Load latest data</Button>
          </div>
        )}
        <fieldset
          className="totake-operation-scope"
          disabled={
            save.busy || save.uncertain || save.conflict || save.offline
          }
        >
          {children}
        </fieldset>
      </dialog>
      {confirm && (
        <Modal title="Discard unsaved changes?" onClose={keep}>
          <div className="destination-body">
            <p>Your changes have not been saved.</p>
            <Button variant="primary" onClick={keep}>
              Keep editing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConfirm(false);
                onClose();
              }}
            >
              Discard changes
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
