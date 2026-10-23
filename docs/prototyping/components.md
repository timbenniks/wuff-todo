# Real components, visible behavior

These demos import Wuff’s shipped React components. The complete inventory below is generated from exported component declarations in `packages/ui/src`, not from the upstream shadcn catalogue. Exact source and signatures are included in the prototype kit.

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

The starter demonstrates TaskRow with in-memory changes and an injected runtime. For another screen, supply only the local mock methods needed by that flow. Unsupported actions should explain that they are not simulated; do not silently contact real services.

## Source and reuse

`packages/ui/src/features/runtime.ts` defines FeatureRuntime and RuntimeContext. It separates components from routing, requests, image retrieval and account behavior. `@wuff/contracts` supplies public types; `@wuff/design` supplies palette derivation; `@wuff/client` supplies typed interfaces. No database or server packages are needed in a prototype.

Inspect the generated inventory for import paths and signatures, then read the matching file in the archive for event behavior and other exported types. Props are exact for this snapshot; the source manifest identifies the copied version. A new export or variant requires a kit rebuild.
