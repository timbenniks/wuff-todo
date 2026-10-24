# Make an idea feel like Wuff

This guide is for people designing Wuff Todo features with an agent. You do not need to code or clone the app. Bring an idea, iterate on a prototype and send Tim a clear specification when it feels right.

Use the early kit download, starter prompt and feature brief template above. Each build links its source base and exact input hashes.

## Start a ChatGPT Work conversation

Paste this instruction with your idea:

> Read https://wuff-todo.vercel.app/docs/agent-context.md. Help me explore a Wuff Todo feature. Ask about the problem, use Wuff’s actual components and design tokens from the linked prototype kit, and show me a working prototype. Iterate with me before preparing a specification. Do not create a Wuff task until I ask you to hand it off.

The guide is public so an agent can read it without signing into your private lists. Examples use synthetic data. Sharing a guide URL never shares your account or tasks.

## What to share with your agent

- This guide and the particular page relevant to your idea.
- Your goal, who benefits, and examples of what feels awkward today.
- Annotated screenshots or sketches you choose to share.
- Feedback on the prototype: what should happen and what should change.

## What the downloads contain

The **prototype kit** is a Vite/React/TypeScript workspace with the actual shared UI, all component source, seven palettes, DM Sans (including italics), Waffles and a sample interaction using the real TaskRow. Your agent runs it in its available build environment; you do not need a local codebase.

The **skill** is a compact reusable instruction with links to the living guide. Use it when your workspace supports custom skills. Otherwise paste its text into your project instructions or conversation. The skill does not grant tools, hosting or account access.

A prototype builder must support React/Vite projects to use the source directly. If it only supports HTML previews, your agent should explain the limitation and identify the result as an approximation. It must not promise actual-component reuse or a published URL it cannot provide.

## From idea to implementation

Explore → prototype → review together → final specification → shared Wuff task → Tim builds → review the result. The task should stand on its own; the conversation is supporting context.
