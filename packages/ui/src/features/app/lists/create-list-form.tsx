"use client";
import { Button } from "../../../button";
import { Input } from "../../../input";
import { NativeSelect } from "../../../native-select";

export function CreateListForm({
  busy,
  create,
  cancel,
  draft,
  onChange,
}: {
  busy: boolean;
  create: (title: string, mode: "simple" | "work") => Promise<void>;
  cancel: () => void;
  draft: { title: string; mode: "simple" | "work" };
  onChange: (draft: { title: string; mode: "simple" | "work" }) => void;
}) {
  const { title, mode } = draft;
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && title.trim()) void create(title.trim(), mode);
      }}
    >
      <label className="grid gap-1 text-sm">
        List name
        <Input
          autoFocus
          required
          maxLength={300}
          value={title}
          readOnly={busy}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="grid gap-1 text-sm">
        List type
        <NativeSelect
          value={mode}
          disabled={busy}
          onChange={(e) =>
            onChange({ ...draft, mode: e.target.value as typeof mode })
          }
        >
          <option value="simple">Simple</option>
          <option value="work">Work</option>
        </NativeSelect>
      </label>
      <p className="text-sm text-muted-foreground">
        Simple is for everyday tasks. Work adds status, priority and assignment.
        New lists are private until you share them.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !title.trim()}
        >
          Create list
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
