# Build features that belong in Wuff

This is Wuff's implementation guide for contributors and their coding agents.
You describe the behavior and try the result. Your agent handles the code, Git,
checks and PR. Tim approves technical scope, reviews and merges.

## Start with your idea

Use the starter prompt above in your authorized repository workspace. Explain the
problem, who benefits and what should become easier. Your agent should offer
small product choices, show the main interaction early and keep a short record of
agreed decisions. You do not need to choose libraries or manage Git yourself.

Describe → agree the brief → Tim approves scope → implement → try the preview →
refine → verify → Tim reviews → Tim merges/releases.

Start at [Build a feature](/docs/build), then use [Review and delivery](/docs/review)
when the result is ready. Read the product rules, design language, real component
reference and accessibility requirements while building.

Read [API, MCP and connections](/docs/surfaces) before defining the feature. Every
persisted-data action needs API/MCP capability parity, an MCP UI decision and a
connection/consent/revocation review; these are part of the approved scope.

## Which instructions do what?

| Layer                                       | Job                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Root and nearby AGENTS.md                   | Repository entry point, architecture boundaries and links to the workflow                 |
| This implementation guide                   | Product rules, real components, design decisions and quality requirements                 |
| wuff-contributor skill                      | Walk the agent through discovery, scope approval, iteration, verification and PR delivery |
| GitHub policy, permissions and owner review | Check declared scope/evidence and control what can reach main                             |

Your current checkout is authoritative. Hosted documentation and downloads may lag
unmerged changes. A skill helps the agent follow the rules; it cannot grant tools,
credentials, hosting or permission to bypass them.

## Your workspace must be ready

Use your own GitHub account and a workspace supplied or approved by Tim. Do not
borrow his credentials, copy production data or test writes on an unverified
preview. A Vercel preview URL does not prove database isolation. The build guide
lists the setup gates; if something is missing, your agent prepares a concrete
technical handoff and can explore a clearly labeled local mock while waiting.

## What to share with your agent

- Your goal, intended users and examples of the current problem.
- Screenshots or sketches you choose to share, plus feedback on early iterations.
- The intended Wuff task if this work is already tracked.
- Which parts of the idea are essential and which can wait.

The guide is public and its component examples use synthetic data. Reading it
never grants access to your private lists or production services. There is one
contributor workflow; the separate prototype kit and design-handoff skill are retired.
