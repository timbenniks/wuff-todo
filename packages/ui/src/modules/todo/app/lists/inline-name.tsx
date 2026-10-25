"use client";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "../../../../input-group";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, Pencil, X } from "lucide-react";

export function InlineName({
  value,
  label,
  editLabel,
  editable = true,
  disabled = false,
  heading,
  completed = false,
  onSave,
  renderActions,
  additionalFields,
  afterName,
  additionalDirty = false,
  className = "",
  compact = false,
  focusFallback,
  readHref,
  onOpen,
}: {
  value: string;
  label: string;
  editLabel: string;
  editable?: boolean;
  disabled?: boolean;
  heading?: "h1" | "h2";
  completed?: boolean;
  onSave: (name: string) => Promise<boolean>;
  additionalFields?: ReactNode;
  afterName?: ReactNode;
  additionalDirty?: boolean;
  className?: string;
  compact?: boolean;
  focusFallback?: RefObject<HTMLButtonElement | null>;
  readHref?: string;
  onOpen?: React.MouseEventHandler<HTMLAnchorElement>;
  renderActions?: (props: {
    edit: () => void;
    editing: boolean;
    trigger: RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(value),
    [original, setOriginal] = useState(value);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    restoreFocus = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (editing && editable) {
      input.current?.focus();
      input.current?.select();
    } else if (restoreFocus.current) {
      const target = trigger.current;
      if (target?.getClientRects().length) target.focus();
      else focusFallback?.current?.focus();
      restoreFocus.current = false;
    }
  }, [editing, editable, focusFallback]);
  function finish() {
    restoreFocus.current = true;
    setEditing(false);
    setError("");
  }
  const typography =
    heading === "h1"
      ? "text-3xl font-bold leading-tight"
      : heading === "h2"
        ? "text-lg font-bold"
        : "text-base";
  const changed = value !== original;
  function begin() {
    setDraft(value);
    setOriginal(value);
    setError("");
    setEditing(true);
  }
  const name =
    editable && !renderActions ? (
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        title={editLabel}
        aria-label={heading ? undefined : editLabel}
        className="group/name inline-flex min-h-11 max-w-full items-start gap-2 rounded-md text-left py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-default"
        onClick={() => {
          setDraft(value);
          setOriginal(value);
          setError("");
          setEditing(true);
        }}
      >
        <span
          className={`min-w-0 break-words ${completed ? "line-through" : ""}`}
        >
          {value}
        </span>
        <Pencil
          size={heading === "h1" ? 17 : 13}
          aria-hidden="true"
          className="shrink-0 mt-1.5 text-muted-foreground group-hover/name:text-primary group-focus-visible/name:text-primary"
        />
      </button>
    ) : (
      <span className={`break-words ${completed ? "line-through" : ""}`}>
        {readHref ? (
          <a
            href={readHref}
            onClick={onOpen}
            className="block truncate py-3 -my-3 rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
            title={`Open task: ${value}`}
            aria-label={`Open task: ${value}`}
          >
            <span className="inline-name-value">{value}</span>
          </a>
        ) : (
          value
        )}
      </span>
    );
  const Heading = heading;
  return (
    <>
      <div className={`min-w-0 flex-1 ${className}`}>
        {editing && editable ? (
          <form
            noValidate
            className={`inline-name-form grid gap-2 py-1 ${compact ? "inline-name-compact" : ""}`}
            data-unsaved={draft !== value || additionalDirty || undefined}
            aria-label={`Edit ${label.toLowerCase()}`}
            onSubmit={async (e) => {
              e.preventDefault();
              if (disabled || pending.current) return;
              const title = draft.trim();
              if (!title) {
                setError("Give it a name to bark about first.");
                input.current?.focus();
                return;
              }
              if (title.length > 300) {
                setError("That’s a long tail! Use 300 characters or fewer.");
                return;
              }
              if (title === value && !additionalDirty) {
                finish();
                return;
              }
              pending.current = true;
              setSaving(true);
              setError("");
              try {
                if (await onSave(title)) finish();
                else
                  setError(
                    "Ruff patch! The name wasn’t saved. Your draft is kept; check the message above and try again.",
                  );
              } catch {
                setError(
                  "Ruff patch! The name wasn’t saved. Your draft is kept. Try again.",
                );
              } finally {
                pending.current = false;
                setSaving(false);
              }
            }}
          >
            <label htmlFor={id} className="sr-only">
              {label}
            </label>
            <InputGroup>
              <InputGroupInput
                id={id}
                ref={input}
                value={draft}
                maxLength={300}
                autoComplete="off"
                readOnly={disabled || saving}
                aria-invalid={!!error}
                aria-describedby={error || changed ? `${id}-notice` : undefined}
                className="text-base"
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing && e.key === "Enter")
                    e.preventDefault();
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!saving && !disabled) finish();
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled || saving}
                  aria-label={
                    saving
                      ? "Saving name"
                      : changed
                        ? "Save my name"
                        : "Save name"
                  }
                  title="Save name"
                >
                  <Check size={14} aria-hidden="true" />
                  <span className="sr-only">
                    {saving
                      ? "Saving, paws a moment…"
                      : changed
                        ? "Save my name"
                        : "Save"}
                  </span>
                </InputGroupButton>
                <InputGroupButton
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || saving}
                  onClick={finish}
                  aria-label="Cancel name edit"
                  title="Cancel name edit"
                >
                  <X size={14} aria-hidden="true" />
                  <span className="sr-only">Cancel</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {additionalFields && (
              <div className="inline-name-extra">{additionalFields}</div>
            )}
            {(error || changed) && (
              <p
                id={`${id}-notice`}
                role={error ? "alert" : "status"}
                className={`text-xs ${error ? "text-red-800" : "text-muted-foreground"}`}
              >
                {error ||
                  `New de-tails! The name changed to “${value}” while you were editing. Keep your draft or cancel to use the latest name.`}
              </p>
            )}
          </form>
        ) : Heading ? (
          <Heading className={`${typography} break-words`}>{name}</Heading>
        ) : (
          name
        )}
        {!editing && afterName}
      </div>
      {renderActions?.({ edit: begin, editing, trigger })}
    </>
  );
}
