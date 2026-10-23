"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ListColor } from "@wuff/contracts";
import { listPalette } from "@wuff/design";
import { ListTheme } from "@wuff/ui/features/components/list-theme";
const links = [
  ["", "Start here"],
  ["product", "Product rules"],
  ["design", "Design language"],
  ["components", "Components"],
  ["accessibility", "Responsive & accessible"],
  ["prototyping", "Make a prototype"],
  ["handoff", "Hand it off"],
];
export function DocsControls() {
  const path = usePathname(),
    [color, setColor] = useState<ListColor>("blue");
  return (
    <>
      <ListTheme color={color} />
      <nav className="docs-nav" aria-label="Guide pages">
        {links.map(([slug, label]) => (
          <Link
            key={slug}
            href={`/docs${slug ? `/${slug}` : ""}`}
            aria-current={
              path === `/docs${slug ? `/${slug}` : ""}` ? "page" : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="docs-palette">
        <span id="palette-label">Try a list palette</span>
        <div role="group" aria-labelledby="palette-label">
          {Object.entries(listPalette).map(([key, palette]) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key as ListColor)}
              aria-pressed={color === key}
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: palette.accent }}
              />
              {palette.label}
            </button>
          ))}
        </div>
        <p role="status">
          {listPalette[color].label} · The same tokens used in Wuff
        </p>
      </div>
    </>
  );
}
