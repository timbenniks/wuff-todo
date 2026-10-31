"use client";
import { useEffect, useRef } from "react";
import { listNavigationContext, type ListSummary } from "@wuff/contracts";
import { NativeSelect } from "../../../../native-select";

export function ListContext({
  lists,
  id,
  choose,
}: {
  lists: ListSummary[];
  id: string;
  choose: (id: string) => void;
}) {
  const { parent, children, siblings } = listNavigationContext(lists, id);
  const more = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const query = matchMedia("(min-width: 768px)");
    const update = () => {
      if (more.current) more.current.open = query.matches;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [id, children.length]);
  if (!parent && !children.length) return null;
  return (
    <div className="list-context">
      {parent && (
        <nav aria-label="List location">
          <button
            className="list-parent-link"
            onClick={() => choose(parent.id)}
          >
            ← {parent.title}
          </button>
          {siblings.length > 0 && (
            <label>
              Sibling lists
              <NativeSelect
                value=""
                onChange={(event) => {
                  if (event.target.value) choose(event.target.value);
                }}
              >
                <option value="">Open another child list</option>
                {siblings.map((sibling) => (
                  <option key={sibling.id} value={sibling.id}>
                    {sibling.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
        </nav>
      )}
      {children.length > 0 && (
        <section aria-labelledby={`child-lists-heading-${id}`}>
          <h2 id={`child-lists-heading-${id}`}>
            Child lists ({children.length})
          </h2>
          <ul className="list-context-links">
            {children.slice(0, 3).map((child) => (
              <li key={child.id}>
                <button onClick={() => choose(child.id)}>
                  {child.title}
                  {child.shared && <small>Shared</small>}
                </button>
              </li>
            ))}
          </ul>
          {children.length > 3 && (
            <details ref={more} className="list-context-more">
              <summary>Show all {children.length} child lists</summary>
              <ul className="list-context-links">
                {children.slice(3).map((child) => (
                  <li key={child.id}>
                    <button onClick={() => choose(child.id)}>
                      {child.title}
                      {child.shared && <small>Shared</small>}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="list-context-note">
            Each child list has its own tasks and sharing.
          </p>
        </section>
      )}
    </div>
  );
}
