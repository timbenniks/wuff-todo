"use client";
import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import { NativeSelect } from "../../../native-select";
import {
  readTodoAppearance,
  setTodoAppearance,
  todoAppearanceEvent,
  type TodoAppearance,
} from "../lib/appearance";
export function TodoAppearanceControl() {
  const [value, setValue] = useState<TodoAppearance>("light");
  useEffect(() => {
    const update = () => setValue(readTodoAppearance());
    update();
    window.addEventListener(todoAppearanceEvent, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(todoAppearanceEvent, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return (
    <label className="todo-appearance-control">
      <Sun size={16} aria-hidden="true" />
      <span>Appearance</span>
      <NativeSelect
        aria-label="Appearance"
        value={value}
        onChange={(event) =>
          setTodoAppearance(event.target.value as TodoAppearance)
        }
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </NativeSelect>
    </label>
  );
}
