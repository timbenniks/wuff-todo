# Real components, visible behavior

These demos import Wuff’s shipped React components. The inventory below is generated
directly from exported declarations in `packages/ui/src`. Use its exact signatures
and inspect event behavior in the current repository source; do not substitute
upstream shadcn defaults or a copied component tree.

Use the component search and jump links to find a component by name or source path. Expand a module for its exact props.

## The primitive layer

| Module                 | Exports and API notes                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| @wuff/ui/button        | Button: primary, default, outline, ghost, danger, destructive; default/sm/icon sizes; asChild; native button props |
| @wuff/ui/input         | Input: native input props, invalid/disabled/focus styling                                                          |
| @wuff/ui/textarea      | Textarea: native textarea props and shared styling                                                                 |
| @wuff/ui/native-select | NativeSelect: native select props/options; inset decorative chevron                                                |
| @wuff/ui/input-group   | InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea                 |
| @wuff/ui/status-tag    | StatusTag: status todo, in_progress, in_review, blocked or done; a label, not a button                             |

InputGroupAddon supports inline-start/end and block-start/end. InputGroupButton exposes xs/sm/icon-xs/icon-sm; use icon-sm or another 44px target for touch actions. The existence of a compact size is not an accessibility guarantee for a new use.

## Feature components

TaskRow, task metadata, notes/editor, due-date controls, task actions, task groups/detail drawer, ListSettings, Sharing, ListApp, personal views, Work metadata, GitHub/agent controls, reminders, sortable controls, Corgi and ListTheme are included. Some depend on FeatureRuntime, parent callbacks, task/list shapes and live state. Use their declared props; do not treat them as isolated zero-configuration primitives.

The interactive TaskRow example uses synthetic data, in-memory changes and an
injected runtime. Unsupported actions explain that they are not simulated; the
guide never contacts private services. This is a component reference, not a
standalone application or proof of backend behavior.

## Source and reuse

`packages/ui/src/features/runtime.ts` defines FeatureRuntime and RuntimeContext.
It separates shared components from routing, requests and account
behavior. `@wuff/contracts` supplies public types; `@wuff/design` supplies palette
derivation; `@wuff/client` supplies the browser-safe live-refresh queue. Real features use the existing
authorized runtime/adapters. Database and domain packages stay server-side.

Inspect import paths and signatures, then read the matching repository file for
event behavior and other types. `pnpm build:guide` refreshes the inventory directly
from source. Download hashes identify the published guide resources, not a copied
app. The current checkout governs any difference from the hosted snapshot.
