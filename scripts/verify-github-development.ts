// Deliberate, guarded live provider test. Never targets a production Wuff DB.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { database } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  getList,
  createTask,
  updateTask,
  githubLink,
  githubTask,
  githubRetry,
  githubResolve,
  githubUnbind,
  githubBind,
  githubRepositories,
  processGithubJobs,
} from "@wuff/domain";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.WUFF_ORIGIN !== "http://localhost:3000"
)
  throw Error("Isolated development only");
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8")),
  actor = { id: user.id, scopes };
const listId = process.argv[2];
if (!listId) throw Error("Supply the disposable fixture list ID");
const repo = "timbenniks/wuff-github-sync-test";
function gh(args: string[]) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
const write = (l: { id: string; version: number }) => ({
  listId: l.id,
  version: l.version,
  operationId: crypto.randomUUID(),
});
async function pump() {
  for (let n = 0; n < 3; n++) {
    const r = await processGithubJobs(2);
    if (!r.processed) break;
  }
}
try {
  let list = await getList(actor, listId);
  assert.equal(list.title, "Weekend things");
  assert.equal(list.mode, "work");
  list = await createTask(actor, {
    ...write(list),
    title: "Synthetic installed-App sync verification",
    content: "**Synthetic notes**",
    status: "in_progress",
  });
  const task = list.tasks.find(
    (t) => t.title === "Synthetic installed-App sync verification",
  )!;
  await githubLink(actor, { ...write(list), taskId: task.id });
  await pump();
  let link = (await githubTask(actor, task.id)).link!;
  assert.equal(
    link.state,
    "synced",
    JSON.stringify({ state: link.state, error: link.error }),
  );
  assert.ok(link.issueNumber);
  await writeFile(
    ".vercel/github-live-state.json",
    JSON.stringify({ listId, taskId: task.id, issueNumber: link.issueNumber }),
    { mode: 0o600 },
  );
  console.log("Live App issue creation passed: issue #" + link.issueNumber);
  list = await getList(actor, list.id);
  list = await updateTask(actor, {
    ...write(list),
    taskId: task.id,
    title: "Synthetic Wuff-to-GitHub edit",
    content: "**Wuff notes update**",
  });
  await pump();
  const remote = JSON.parse(
    gh([
      "issue",
      "view",
      String(link.issueNumber),
      "--repo",
      repo,
      "--json",
      "title,body,state",
    ]),
  );
  assert.equal(remote.title, "Synthetic Wuff-to-GitHub edit");
  assert.ok(remote.body.includes("**Wuff notes update**"));
  console.log("Live Wuff-to-GitHub title/notes passed.");
  gh([
    "issue",
    "edit",
    String(link.issueNumber),
    "--repo",
    repo,
    "--title",
    "Synthetic GitHub-to-Wuff edit",
    "--body",
    "**GitHub notes update**",
  ]);
  list = await getList(actor, list.id);
  await githubRetry(actor, { ...write(list), taskId: task.id });
  await pump();
  list = await getList(actor, list.id);
  assert.equal(
    list.tasks.find((t) => t.id === task.id)!.title,
    "Synthetic GitHub-to-Wuff edit",
  );
  assert.equal(
    list.tasks.find((t) => t.id === task.id)!.content,
    "**GitHub notes update**",
  );
  for (const [command, status] of [
    ["close", "done"],
    ["reopen", "todo"],
  ]) {
    gh(["issue", command, String(link.issueNumber), "--repo", repo]);
    list = await getList(actor, list.id);
    await githubRetry(actor, { ...write(list), taskId: task.id });
    await pump();
    list = await getList(actor, list.id);
    assert.equal(list.tasks.find((t) => t.id === task.id)!.status, status);
  }
  console.log("Live GitHub-to-Wuff notes/title/close/reopen passed.");
  list = await updateTask(actor, {
    ...write(list),
    taskId: task.id,
    title: "Synthetic divergent Wuff title",
  });
  gh([
    "issue",
    "edit",
    String(link.issueNumber),
    "--repo",
    repo,
    "--title",
    "Synthetic divergent GitHub title",
  ]);
  await pump();
  link = (await githubTask(actor, task.id)).link!;
  assert.equal(link.state, "conflict");
  await githubResolve(actor, {
    ...write(list),
    taskId: task.id,
    revision: link.revision,
    choice: "github",
  });
  await pump();
  list = await getList(actor, list.id);
  assert.equal(
    list.tasks.find((t) => t.id === task.id)!.title,
    "Synthetic divergent GitHub title",
  );
  console.log("Live divergent edits and explicit conflict resolution passed.");
  await githubUnbind(actor, { ...write(list) });
  list = await getList(actor, list.id);
  await githubRetry(actor, { ...write(list), taskId: task.id });
  await pump();
  assert.equal(
    (await githubTask(actor, task.id)).link?.error,
    "github_inactive",
  );
  const repository = (await githubRepositories(actor)).repositories.find(
    (r: any) => r.name === repo,
  );
  assert.ok(repository);
  await githubBind(actor, {
    ...write(list),
    ...repository,
    shareWithList: true,
  });
  list = await getList(actor, list.id);
  await githubRetry(actor, { ...write(list), taskId: task.id });
  await pump();
  assert.equal((await githubTask(actor, task.id)).link?.state, "synced");
  console.log(
    "Live Wuff disconnect/rebind recovery passed. Synthetic issue retained for webhook verification.",
  );
} finally {
  await database().pool.end();
}
