"use client";
import { useState } from "react";
import catalog from "./catalog.generated.json";
export function ComponentCatalog() {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const items = catalog.filter((item) =>
    `${item.source} ${item.components.map((c) => c.name).join(" ")}`
      .toLowerCase()
      .includes(search),
  );
  return (
    <section
      className="docs-catalog"
      aria-labelledby="catalog-heading"
      id="component-catalog"
    >
      <h2 id="catalog-heading">Find a component</h2>
      <label className="docs-component-search">
        Search components or source paths
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Button, TaskRow, reminders…"
        />
      </label>
      <p role="status">
        {items.reduce((n, item) => n + item.components.length, 0)} components in{" "}
        {items.length} modules. Exact props and source paths are below.
      </p>
      <nav aria-label="Component jump links" className="docs-component-jumps">
        {items.map((item) => (
          <a
            key={item.source}
            href={`#module-${item.components[0].name.toLowerCase()}`}
            onClick={() => {
              const el = document.getElementById(
                `module-${item.components[0].name.toLowerCase()}`,
              );
              if (el instanceof HTMLDetailsElement) el.open = true;
            }}
          >
            {item.components.map((c) => c.name).join(", ")}
          </a>
        ))}
      </nav>
      {!items.length && (
        <p>No matching components. Try a name such as Button or TaskRow.</p>
      )}
      {items.map((item) => (
        <details
          className="docs-source"
          key={item.source}
          id={`module-${item.components[0].name.toLowerCase()}`}
        >
          <summary>{item.components.map((c) => c.name).join(", ")}</summary>
          <p>
            <code>{item.module}</code>
          </p>
          <p className="docs-caption">{item.source}</p>
          {item.components.map((component) => (
            <pre key={component.name}>
              <code>{component.signature}</code>
            </pre>
          ))}
        </details>
      ))}
    </section>
  );
}
