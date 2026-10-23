"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@wuff/ui/button";
import { Input } from "@wuff/ui/input";
import { Textarea } from "@wuff/ui/textarea";
import { NativeSelect } from "@wuff/ui/native-select";
import { StatusTag } from "@wuff/ui/status-tag";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@wuff/ui/input-group";
import { App as Prototype } from "./prototype-demo";

export function ComponentExamples() {
  const [status, setStatus] = useState(""),
    [input, setInput] = useState("");
  return (
    <div className="docs-examples">
      <section aria-labelledby="button-example">
        <h2 id="button-example">Buttons, with intent</h2>
        <p>
          These are the shipped variants. Try them to see focus, hover and
          feedback.
        </p>
        <div className="docs-demo-wrap">
          {(
            [
              "primary",
              "default",
              "outline",
              "ghost",
              "danger",
              "destructive",
            ] as const
          ).map((variant) => (
            <Button
              key={variant}
              variant={variant}
              type="button"
              onClick={() =>
                setStatus(
                  `${variant}: this is a demonstration; nothing was changed.`,
                )
              }
            >
              {
                {
                  primary: "Save changes",
                  default: "Cancel",
                  outline: "Secondary action",
                  ghost: "Quiet action",
                  danger: "Delete",
                  destructive: "Confirm delete",
                }[variant]
              }
            </Button>
          ))}
          <Button disabled>Disabled</Button>
        </div>
        <p className="docs-demo-status" role="status">
          {status || "No changes are saved by these examples."}
        </p>
      </section>
      <section aria-labelledby="field-example">
        <h2 id="field-example">Fields that feel familiar</h2>
        <div className="docs-field-grid">
          <label>
            Task name
            <Input
              placeholder="A little more de-tail"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <label>
            Disabled field
            <Input disabled value="Read-only example" readOnly />
          </label>
          <label>
            List color
            <NativeSelect defaultValue="blue">
              <option value="blue">Blue</option>
              <option value="sage">Sage</option>
            </NativeSelect>
          </label>
          <label>
            Validation example
            <Input
              aria-invalid="true"
              aria-describedby="docs-field-error"
              defaultValue=""
            />
            <span id="docs-field-error" className="docs-field-error">
              A task needs a name.
            </span>
          </label>
          <label className="docs-wide">
            Notes
            <Textarea rows={3} placeholder="Describe the idea…" />
          </label>
        </div>
      </section>
      <section aria-labelledby="group-example">
        <h2 id="group-example">Grouped inputs</h2>
        <label htmlFor="grouped-task">Quick task capture</label>
        <InputGroup>
          <InputGroupInput id="grouped-task" placeholder="Name a new task" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-sm"
              aria-label="Demonstrate add task"
              onClick={() => setStatus("Grouped input: demonstration only.")}
            >
              <Plus size={18} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <label htmlFor="grouped-note">Note with supporting text</label>
        <InputGroup>
          <InputGroupTextarea id="grouped-note" rows={2} />
          <InputGroupAddon align="block-end">
            <InputGroupText>Only a prototype. Nothing is sent.</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </section>
      <section aria-labelledby="status-example">
        <h2 id="status-example">Status is information</h2>
        <p>Labels and icons keep these meaningful without relying on color.</p>
        <div className="docs-demo-wrap">
          {(
            ["todo", "in_progress", "in_review", "blocked", "done"] as const
          ).map((state) => (
            <StatusTag key={state} status={state} />
          ))}
        </div>
      </section>
      <section aria-labelledby="task-example">
        <h2 id="task-example">The actual task row</h2>
        <p>
          The downloadable starter below runs here too. Try completion,
          renaming, notes, dates and subtasks. Data stays in this demonstration.
          Opening it resets its sample state.
        </p>
        <details className="docs-source">
          <summary>Open the interactive prototype starter</summary>
          <Prototype embedded />
        </details>
      </section>
    </div>
  );
}
