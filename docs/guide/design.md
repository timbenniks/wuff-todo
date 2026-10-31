# Wuff’s visual language

Wuff is calm, compact and warm. Waffles is a small companion, not a corporate mascot. Keep tasks and readable controls in charge. Use the live palette selector on this guide to see the same color derivation used by the product.

## Use the actual tokens

Import `listPalette` and `listThemeVariables` from `@wuff/design`, or render `ListTheme` from the shared UI. For Todo, `ListTheme` uses `todoThemeVariables`: Light (the default) preserves the original list-colored page/sidebar/surface roles; Dark derives tinted surfaces from the selected list. Appearance offers Light, Dark and System, remembers the device choice and follows system appearance only when requested. Other modules retain their existing palette derivation. Todo’s filled actions use `--wuff-action` for white-label contrast; the lighter dark-mode link accent is separate. Settings drafts do not silently save or preview a new list color. Auth and contexts with no selected list use Blue.

<!-- PALETTE_TABLE -->

The reference tint is a palette entry, not a substitute for derived page or surface values. The base CSS roles are `--wuff-primary`, `--wuff-primary-hover`, `--wuff-background`, `--wuff-surface`, `--wuff-sidebar`, `--wuff-accent`, `--wuff-foreground`, `--wuff-muted`, `--wuff-border`, and `--wuff-control`. Use their semantic Tailwind names (`bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-input`, `outline-primary`). Subtle separators and interactive control boundaries are deliberately different colors.

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

## Todo productivity surfaces

Todo’s shared `productivity.css` builds on these primitives with a 4px spacing
scale, 24px list titles, 14px section/body text, 12px metadata, 8px radii and
48px task rows. Retain 44px action hit areas; compact sidebar disclosure/drag
controls expand on coarse pointers. Selection uses the palette’s quiet accent surface.
Favorites are flat shortcuts; the canonical Your lists tree owns nesting. Sidebar
width defaults to 260px and remains device-local; reset lives in Sidebar options.
Desktop navigation flows with the document instead of a nested list scrollbar.
Fine-pointer sidebar rows use 36px spacing with contextual drag/action controls;
touch targets remain 44px. Long list titles wrap in the main heading.

Lists open on Tasks. When sublists exist, Tasks / Sublists tabs separate task
controls from an aligned sublist directory. Switching tabs preserves task drafts;
Add task returns to Tasks. Parent/sibling navigation stays available for child
lists. This is transient web/PWA navigation, not a synced preference.

The list title/count and Add task anchor the workspace. Search and Filter remain
visible; View contains sorting, grouping, display and saved views. Default rows
show populated metadata only; explicit saved column layouts remain supported.
Sections are lightweight disclosure headings. Add task opens a scoped inline
composer: Enter adds and keeps it available, Escape cancels, uncertain requests
retain the draft and exact retry.

The 520px task drawer keeps list context and completion beside the editable title.
Properties are quiet value controls, notes show formatting only while editing,
and subtasks use the same inline capture. Preserve unsaved-change guards, Escape,
origin focus and list scroll. Overview presents Today/Coming up before a compact
list browser. See [the redesign contract](../todo-productivity-redesign.md).
