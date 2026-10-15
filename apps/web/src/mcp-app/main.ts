import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Wuff Todo", version: "0.1.0" }, {});
let current:
  | {
      id: string;
      title: string;
      version: number;
      tasks: { id: string; title: string; completed: boolean }[];
    }
  | undefined;
const root = document.querySelector<HTMLElement>("#app")!;
const status = document.querySelector<HTMLElement>("#status")!;
async function call(name: string, args: Record<string, unknown>) {
  status.textContent = "Saving…";
  try {
    const result = await app.callServerTool({ name, arguments: args });
    if (result.isError)
      throw new Error("Couldn’t save. Reopen the list and try again.");
    show(result.structuredContent);
    status.textContent = "Saved";
  } catch (e) {
    status.textContent = (e as Error).message;
  }
}
function show(value: unknown) {
  const data = value as {
    list?: typeof current;
    lists?: { id: string; title: string }[];
  };
  root.replaceChildren();
  if (data.lists) {
    const title = document.createElement("h1");
    title.textContent = "Your lists";
    root.append(title);
    for (const list of data.lists) {
      const button = document.createElement("button");
      button.className = "list";
      button.textContent = list.title;
      button.onclick = () => call("show_list", { listId: list.id });
      root.append(button);
    }
    if (!data.lists.length) {
      const p = document.createElement("p");
      p.textContent =
        "Create your first list on Wuff, or ask your AI assistant to create one.";
      root.append(p);
    }
    return;
  }
  if (!data.list) return;
  current = data.list;
  const title = document.createElement("h1");
  title.textContent = current.title;
  root.append(title);
  for (const task of current.tasks) {
    const row = document.createElement("label");
    row.className = "task";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.completed;
    check.onchange = () => {
      check.disabled = true;
      call("update_task", {
        listId: current!.id,
        version: current!.version,
        taskId: task.id,
        completed: check.checked,
        operationId: crypto.randomUUID(),
      });
    };
    const text = document.createElement("span");
    text.textContent = task.title;
    if (task.completed) text.style.textDecoration = "line-through";
    row.append(check, text);
    root.append(row);
  }
  const form = document.createElement("form"),
    input = document.createElement("input"),
    button = document.createElement("button");
  input.required = true;
  input.maxLength = 300;
  input.placeholder = "Add a task…";
  input.setAttribute("aria-label", "New task");
  button.textContent = "Add";
  form.append(input, button);
  form.onsubmit = (event) => {
    event.preventDefault();
    button.disabled = true;
    call("create_task", {
      listId: current!.id,
      version: current!.version,
      title: input.value,
      operationId: crypto.randomUUID(),
    });
  };
  root.append(form);
}
app.ontoolresult = (result) => {
  show(result.structuredContent);
};
app.connect().catch(() => {
  status.textContent = "Open this view in a client that supports MCP Apps.";
});
