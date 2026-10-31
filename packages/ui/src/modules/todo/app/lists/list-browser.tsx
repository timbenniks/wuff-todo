"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Star } from "lucide-react";
import { findListGroups, type ListSummary } from "@wuff/contracts";
import { Button } from "../../../../button";
import { Input } from "../../../../input";
import { listPalette } from "../../lib/list-colors";

export function ListBrowser({
  lists,
  choose,
  create,
  favorite,
  busy,
}: {
  lists: ListSummary[];
  choose: (id: string) => void;
  create: () => void;
  favorite: (id: string, enabled: boolean) => Promise<boolean>;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const groups = findListGroups(lists, query);
  function link(list: ListSummary) {
    return (
      <button
        className="list-browser-link"
        title={list.title}
        onClick={() => choose(list.id)}
      >
        <span
          className="list-color-marker"
          style={{ background: listPalette[list.color].accent }}
          aria-hidden="true"
        />
        <span>{list.title}</span>
        {list.shared && <small>Shared</small>}
      </button>
    );
  }
  return (
    <section className="list-browser" aria-labelledby="your-lists-title">
      <header className="list-browser-heading">
        <div>
          <h2 id="your-lists-title">Your lists</h2>
          <p>Everything you’re working on, in one place.</p>
        </div>
        <Button onClick={create} disabled={busy}>
          <Plus size={17} aria-hidden="true" />
          New list
        </Button>
      </header>
      <label className="list-browser-search">
        Find a list
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search list names"
        />
      </label>
      <div className="list-browser-grid">
        {groups.map(({ list, children }) => {
          const expanded = !!query.trim() || !collapsed.has(list.id);
          return (
            <article key={list.id} className="list-browser-card">
              <div className="list-browser-card-heading">
                {link(list)}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={`${list.favorite ? "Remove" : "Add"} ${list.title} ${list.favorite ? "from" : "to"} favorites`}
                  aria-pressed={!!list.favorite}
                  onClick={() => void favorite(list.id, !list.favorite)}
                >
                  <Star
                    size={17}
                    fill={list.favorite ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </Button>
              </div>
              {children.length > 0 && (
                <>
                  <button
                    className="list-browser-disclosure"
                    disabled={!!query.trim()}
                    aria-expanded={expanded}
                    aria-controls={`overview-children-${list.id}`}
                    onClick={() =>
                      setCollapsed((old) => {
                        const next = new Set(old);
                        if (next.has(list.id)) next.delete(list.id);
                        else next.add(list.id);
                        return next;
                      })
                    }
                  >
                    {expanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    {children.length} child{" "}
                    {children.length === 1 ? "list" : "lists"}
                  </button>
                  <ul id={`overview-children-${list.id}`} hidden={!expanded}>
                    {children.map((child) => (
                      <li key={child.id}>{link(child)}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          );
        })}
      </div>
      {!groups.length && (
        <p className="list-browser-empty">
          {query.trim()
            ? "No lists match your search. Try another name."
            : "Create a list to get started."}
        </p>
      )}
    </section>
  );
}
