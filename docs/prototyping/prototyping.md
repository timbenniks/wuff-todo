# Prototype without a local codebase

Your agent handles the build environment. You review the result through its preview or a shared prototype URL. This guide does not require repository access or live Wuff credentials.

## The technical baseline

Use Vite, React, TypeScript and Tailwind CSS, with Wuff’s actual shadcn-style UI. The downloadable starter has pinned base versions aligned with the app: React 19.3.1, Vite 8.3.5, TypeScript 5.9.x, Tailwind 4.3.x and pnpm 10.33.3, targeting Node 22. Dependency installation needs package-registry access.

The archive contains the complete current shared UI/client/contracts/design source and original package manifests. Workspace packages resolve inside the archive; they are not published npm dependencies. The generated source manifest records hashes for every included file. Preserve the baseline packages when prototyping, and create new compositions under src.

## Agent setup

1. Read the plain-text reference and download the prototype kit from this guide.
2. Extract it into the available cloud workspace. Run pnpm install, then pnpm dev for a preview or pnpm build for a shareable static build.
3. Develop the idea using imports from @wuff/ui and @wuff/design. Do not overwrite them with default shadcn components.
4. Use the available hosting/preview tool when the human requests a shareable prototype. Preserve source/export and an exact prototype version with the URL.

The agent must verify what its environment supports. A skill does not install a compiler, grant a Sites plugin, create an account or publish a website. If the host cannot execute or publish this project, return the source and a supported preview and explain the limitation. Do not claim that this specific starter has been tested inside ChatGPT Work until it has been run there.

## Mock the behavior, keep the rules

Use synthetic sample people, lists, tasks and images. The starter keeps changes in React state; refresh resets them. It uses real TaskRow controls with local callbacks. Account/session behavior, collaboration delivery, image uploads, external integrations and reminder transport need explicit mocks when a proposal exercises them. Unsupported actions visibly explain the limitation.

Show owner/editor roles, permission denial, slow/failed/conflicting saves, long content and empty states as relevant. A successful mock does not prove backend authorization, real notifications or production persistence. New permissions and shared behaviors belong in the final brief as proposed changes.

## Keep the iteration useful

Ask for the goal and demonstrate the main interaction early. Use short choices and annotated images rather than requiring technical decisions from the designer. Keep a decision log so the final brief reflects the agreed design rather than every abandoned idea. Make visual departures deliberate and label any proposed component additions.

For the available cloud/local modes and project context, see [OpenAI’s ChatGPT Work guidance](https://learn.chatgpt.com/docs/use-chatgpt). Availability of a particular builder or plugin must be checked in her own workspace.
