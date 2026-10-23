# Wuff’s visual language

Wuff is calm, compact and warm. Waffles is a small companion, not a corporate mascot. Keep tasks and readable controls in charge. Use the live palette selector on this guide to see the same color derivation used by the product.

## Use the actual tokens

Import `listPalette` and `listThemeVariables` from `@wuff/design`, or render `ListTheme` from the shared UI. The selected list drives the full experience: page, sidebar, surfaces, controls, text and focus. Settings drafts do not silently save or preview a new list color. Auth and contexts with no selected list use Blue.

<!-- PALETTE_TABLE -->

The reference tint is a palette entry, not a substitute for derived page or surface values. The ten CSS roles are `--wuff-primary`, `--wuff-primary-hover`, `--wuff-background`, `--wuff-surface`, `--wuff-sidebar`, `--wuff-accent`, `--wuff-foreground`, `--wuff-muted`, `--wuff-border`, and `--wuff-control`. Use their semantic Tailwind names (`bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-input`, `outline-primary`). Subtle separators and interactive control boundaries are deliberately different colors.

Semantic status colors stay recognizable across list palettes: review violet, blocked/danger red, done green. Reuse StatusTag and shared CSS rather than deriving these from the list accent.

## Type, spacing and shape

DM Sans is used for headings, body text and controls, with real italic font files for notes. Code is monospace. Use the bundled fonts and license; do not fetch a different family from a CDN.

Shared buttons use a 44px minimum height, 8px radius, 14px/20px semibold labels and 8px internal gaps. Inputs/selects are 44px high, text-base and rounded-md; textareas grow with content. Status tags are compact, non-interactive text/icon badges. These are actual component defaults, not permission to shrink touch targets.

Favor small, purposeful gaps (4/8/12/16/24px) and quiet borders. Keep the task’s completion, name and actions aligned. Current TaskRow CSS has completion and trailing actions at 44px around flexible content, without a permanent empty drag gutter. Read the source when extending a row; historical screenshots may predate its latest layout.

## Actions and feedback

| Intent                        | Existing treatment                                         |
| ----------------------------- | ---------------------------------------------------------- |
| Primary/add/save              | Button variant primary; filled list accent, explicit label |
| Secondary/cancel              | default or outline; bordered surface                       |
| Quiet utility                 | ghost; named icon or concise words                         |
| Destructive utility           | danger; quiet red                                          |
| Confirm irreversible deletion | destructive; filled red with explicit consequence          |

A new shadcn component is a proposal until integrated. Do not run shadcn init or replace Wuff’s controls with stock shadcn styling. Wuff does not ship every upstream primitive: for example, it uses a native select and several feature-owned dialogs/disclosures rather than a universal Select/Dialog library.

## Voice

Labels such as Save notes, Cancel, Delete list and Allow connection stay literal. A short friendly dog joke can appear in surrounding guidance: “No tasks to fetch,” or “A little more de-tail.” Avoid stacking jokes and never hide failures, permissions or destructive consequences. Keep user-written titles and notes unchanged.
