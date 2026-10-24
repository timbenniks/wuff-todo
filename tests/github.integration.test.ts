import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { database } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  createTask,
  deleteList,
  getList,
  updateTask,
  githubStart,
  githubCallback,
  githubBind,
  githubLink,
  githubTask,
  githubResolve,
  githubRetry,
  githubList,
  githubUnbind,
  githubUnlink,
  githubWebhook,
  processGithubJobs,
  githubPullRequests,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const a = { id: crypto.randomUUID(), scopes },
  b = { id: crypto.randomUUID(), scopes };
const write = (l: { id: string; version: number }) => ({
  listId: l.id,
  version: l.version,
  operationId: crypto.randomUUID(),
});
after(async () => database().pool.end());
test("GitHub ownership, durable sync, duplicate deliveries, conflicts and revocation on isolated DB (provider mocked)", async () => {
  for (const actor of [a, b])
    await database().pool.query(
      "insert into wuff_users(id,email,name) values($1,$2,$3)",
      [actor.id, `${actor.id}@example.invalid`, "Synthetic GitHub owner"],
    );
  const oldFetch = globalThis.fetch,
    oldEnv = { ...process.env };
  Object.assign(process.env, {
    GITHUB_APP_ID: "5355720",
    GITHUB_APP_CLIENT_ID: "synthetic-client",
    GITHUB_APP_CLIENT_SECRET: "synthetic-client-secret",
    GITHUB_TOKEN_SECRET: crypto.randomUUID(),
    GITHUB_WEBHOOK_SECRET: "synthetic-webhook-secret",
    GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from(
      generateKeyPairSync("rsa", {
        modulusLength: 2048,
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      }).privateKey,
    ).toString("base64"),
  });
  let created = 0,
    loseCreateResponse = false;
  const issues: any[] = [];
  const pull = {
    number: 42,
    title: "Synthetic PR",
    state: "open",
    draft: true,
    merged_at: null as string | null,
    base: { repo: { id: 600 } },
    head: { sha: "synthetic-head" },
  };
  const response = (v: any) => Response.json(v);
  globalThis.fetch = async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    if (
      url.hostname === "github.com" &&
      url.pathname === "/login/oauth/access_token"
    )
      return response({
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
        expires_in: 28800,
      });
    assert.equal(url.hostname, "api.github.com", "No unrelated network calls");
    if (url.pathname === "/user")
      return response({ id: 5001, login: "synthetic-owner" });
    if (url.pathname === "/user/installations")
      return response({
        installations: [{ id: 500, app_id: 5355720, account: { id: 5001 } }],
      });
    if (url.pathname === "/user/installations/500/repositories")
      return response({
        repositories: [
          {
            id: 600,
            full_name: "synthetic-owner/sync-test",
            private: true,
            permissions: { admin: true },
          },
        ],
      });
    if (url.pathname === "/repositories/600")
      return response({ id: 600, full_name: "synthetic-owner/sync-test" });
    if (url.pathname === "/app/installations/500/access_tokens")
      return response({ token: "synthetic-installation" });
    if (url.pathname.endsWith("/timeline"))
      return response([
        {
          event: "cross-referenced",
          source: {
            issue: { number: 42, pull_request: {}, repository: { id: 600 } },
          },
        },
        {
          event: "cross-referenced",
          source: {
            issue: { number: 99, pull_request: {}, repository: { id: 999 } },
          },
        },
      ]);
    if (url.pathname.endsWith("/pulls/42")) return response(pull);
    if (url.pathname.endsWith("/pulls/42/reviews"))
      return response([{ user: { id: 1 }, state: "APPROVED" }]);
    if (url.pathname.endsWith("/check-runs"))
      return response({
        total_count: 1,
        check_runs: [{ status: "completed", conclusion: "failure" }],
      });
    if (url.pathname === "/repos/synthetic-owner/sync-test/issues") {
      if (init?.method === "POST") {
        created++;
        const body = JSON.parse(String(init.body));
        const issue = {
          ...body,
          number: created,
          node_id: `node-${created}`,
          state: "open",
          updated_at: `stamp-${created}`,
        };
        issues.push(issue);
        if (loseCreateResponse) {
          loseCreateResponse = false;
          throw Error("Synthetic lost create response");
        }
        return response(issue);
      }
      return response(issues);
    }
    const number = Number(url.pathname.split("/").at(-1)),
      issue = issues.find((i) => i.number === number);
    if (issue) {
      if (init?.method === "PATCH")
        Object.assign(issue, JSON.parse(String(init.body)), {
          updated_at: crypto.randomUUID(),
        });
      return response(issue);
    }
    throw Error("Unexpected synthetic provider request");
  };
  let list = await createList(a, {
    title: "Synthetic GitHub lifecycle",
    mode: "work",
    operationId: crypto.randomUUID(),
  });
  try {
    const start = await githubStart(a, "http://localhost:3000"),
      state = new URL(start.url).searchParams.get("state")!;
    await assert.rejects(
      githubCallback(b, "synthetic-code", state, "http://localhost:3000"),
      { code: "github_state" },
    );
    await githubCallback(a, "synthetic-code", state, "http://localhost:3000");
    await assert.rejects(
      githubCallback(a, "synthetic-code", state, "http://localhost:3000"),
      { code: "github_state" },
    );
    await assert.rejects(
      githubBind(b, {
        ...write(list),
        installationId: 500,
        repositoryId: 600,
        shareWithList: true,
      }),
      { code: "not_found" },
    );
    await assert.rejects(
      githubBind(a, {
        ...write(list),
        installationId: 500,
        repositoryId: 601,
        shareWithList: true,
      }),
      { code: "github_repository" },
    );
    const bind = {
      ...write(list),
      installationId: 500,
      repositoryId: 600,
      shareWithList: true,
    };
    await githubBind(a, bind);
    await githubBind(a, bind);
    list = await getList(a, list.id);
    list = await createTask(a, { ...write(list), title: "Linked task" });
    const task = list.tasks[0];
    const link = { ...write(list), taskId: task.id };
    await githubLink(a, link);
    await githubLink(a, link);
    await assert.rejects(
      githubLink(
        { ...a, scopes: ["lists:read", "tasks:write", "lists:manage"] },
        link,
      ),
      { code: "forbidden" },
    );
    await assert.rejects(githubTask(b, task.id), { code: "not_found" });
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    const pendingSnapshot = await getList(a, list.id);
    assert.equal(
      pendingSnapshot.tasks.find((t) => t.id === task.id)!.github?.state,
      "pending",
    );
    assert.equal(
      pendingSnapshot.github?.repository,
      "synthetic-owner/sync-test",
    );
    await processGithubJobs();
    assert.equal(created, 1);
    assert.equal((await githubTask(a, task.id)).link?.state, "synced");
    const prs = await githubPullRequests(a, task.id);
    assert.equal(prs.pullRequests.length, 1);
    assert.equal(prs.pullRequests[0].state, "draft");
    assert.equal(prs.pullRequests[0].review, "approved");
    assert.equal(prs.pullRequests[0].checks, "failing");
    await assert.rejects(githubPullRequests(b, task.id), { code: "not_found" });
    pull.merged_at = new Date().toISOString();
    pull.state = "closed";
    const prPayload = JSON.stringify({
      action: "closed",
      installation: { id: 500 },
      repository: { id: 600 },
      pull_request: { number: 42 },
    });
    const prSignature = `sha256=${createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(prPayload).digest("hex")}`;
    const prDelivery = crypto.randomUUID();
    await githubWebhook(prPayload, prSignature, prDelivery, "pull_request");
    const versionAfterPr = (await getList(a, list.id)).version;
    await githubWebhook(prPayload, prSignature, prDelivery, "pull_request");
    assert.equal(
      (await getList(a, list.id)).version,
      versionAfterPr,
      "duplicate PR event does not bump version twice",
    );
    assert.equal(
      (await githubPullRequests(a, task.id)).pullRequests[0].state,
      "merged",
    );
    assert.equal(
      (await getList(a, list.id)).tasks[0].status,
      "todo",
      "PR merge alone does not finish the task",
    );
    const syncedSnapshot = await getList(a, list.id);
    assert.equal(
      syncedSnapshot.tasks.find((t) => t.id === task.id)!.github?.issueNumber,
      1,
    );
    assert.equal(
      syncedSnapshot.tasks.find((t) => t.id === task.id)!.github?.state,
      "synced",
    );
    list = await getList(a, list.id);
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      title: "Wuff edit",
    });
    const holding = await database().pool.connect();
    try {
      await holding.query("begin");
      await holding.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        [`github:${task.id}`],
      );
      const processing = processGithubJobs();
      try {
        // Wait until the worker has claimed the job, then let it encounter
        // the held task lock. Its lease must be released and retried promptly.
        for (let n = 0; n < 40; n++) {
          const {
            rows: [job],
          } = await database().pool.query(
            "select lease_until from wuff_github_jobs where task_id=$1",
            [task.id],
          );
          if (job?.lease_until) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        await holding.query("rollback");
      }
      await processing;
    } finally {
      holding.release();
    }
    assert.equal(issues[0].title, "Wuff edit");
    issues[0].body = "GitHub notes";
    issues[0].state = "closed";
    const delivery = crypto.randomUUID(),
      payload = JSON.stringify({
        action: "edited",
        installation: { id: 500 },
        repository: { id: 600 },
        issue: { number: 1 },
      }),
      signature = `sha256=${createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(payload).digest("hex")}`;
    await assert.rejects(
      githubWebhook(payload, "invalid", delivery, "issues"),
      { code: "github_signature" },
    );
    await githubWebhook(payload, signature, delivery, "issues");
    await githubWebhook(payload, signature, delivery, "issues");
    await processGithubJobs();
    list = await getList(a, list.id);
    assert.equal(list.tasks[0].content, "GitHub notes");
    assert.equal(list.tasks[0].status, "done");
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      title: "Local divergent",
    });
    issues[0].title = "Remote divergent";
    await processGithubJobs();
    const conflict = (await githubTask(a, task.id)).link!;
    assert.equal(conflict.state, "conflict");
    await assert.rejects(
      githubResolve(a, {
        ...write(list),
        taskId: task.id,
        revision: conflict.revision - 1,
        choice: "github",
      }),
      { code: "conflict" },
    );
    await githubResolve(a, {
      ...write(list),
      taskId: task.id,
      revision: conflict.revision,
      choice: "github",
    });
    await processGithubJobs();
    list = await getList(a, list.id);
    assert.equal(list.tasks[0].title, "Remote divergent");
    // The provider created the issue, but Wuff did not receive its response.
    // Recover the original issue and preserve an edit made during that uncertainty.
    list = await createTask(a, { ...write(list), title: "Uncertain create" });
    const uncertain = list.tasks.find((t) => t.title === "Uncertain create")!;
    loseCreateResponse = true;
    await githubLink(a, { ...write(list), taskId: uncertain.id });
    await processGithubJobs();
    assert.equal(
      (await githubTask(a, uncertain.id)).link?.error,
      "github_create_uncertain",
    );
    list = await getList(a, list.id);
    list = await updateTask(a, {
      ...write(list),
      taskId: uncertain.id,
      title: "Changed while uncertain",
    });
    await processGithubJobs();
    assert.equal(created, 2);
    assert.equal(issues[1].title, "Changed while uncertain");
    assert.equal((await githubTask(a, uncertain.id)).link?.state, "synced");
    // Owner opt-in affects only future top-level tasks, atomically with creation.
    list = await getList(a, list.id);
    await githubBind(a, { ...bind, ...write(list), autoCreateIssues: true });
    assert.equal((await githubList(a, list.id)).binding.autoCreateIssues, true);
    assert.equal((await githubTask(a, uncertain.id)).link?.issueNumber, 2);
    list = await getList(a, list.id);
    const beforeAutomatic = list.tasks.length;
    const localInput = {
      ...write(list),
      title: "No GitHub permission",
      content: "<b>Local-only notes</b>",
    };
    const localActor = {
      ...a,
      scopes: ["lists:read", "tasks:write"] as const,
    };
    await Promise.all([
      createTask(localActor, localInput),
      createTask(localActor, localInput),
    ]);
    list = await getList(a, list.id);
    const localOnly = list.tasks.find((t) => t.title === localInput.title)!;
    assert.equal(list.tasks.length, beforeAutomatic + 1);
    assert.equal((await githubTask(a, localOnly.id)).link, null);
    await processGithubJobs();
    assert.equal(created, 2, "No GitHub write without explicit permission");
    // A later authorized read/edit never backfills an issue for a local task.
    list = await updateTask(a, {
      ...write(list),
      taskId: localOnly.id,
      title: "Still local",
    });
    assert.equal((await githubTask(a, localOnly.id)).link, null);
    await assert.rejects(
      createTask(a, {
        ...write(list),
        title: "Unsafe export",
        content: "<script>private</script>",
      }),
      { code: "github_unsupported_content" },
    );
    assert.equal((await getList(a, list.id)).tasks.length, beforeAutomatic + 1);
    const automatic = {
      ...write(list),
      title: "Automatic issue",
      status: "done",
    };
    await Promise.all([createTask(a, automatic), createTask(a, automatic)]);
    list = await getList(a, list.id);
    const autoTask = list.tasks.find((t) => t.title === "Automatic issue")!;
    assert.equal(list.tasks.length, beforeAutomatic + 2);
    assert.equal((await githubTask(a, autoTask.id)).link?.state, "pending");
    loseCreateResponse = true;
    await processGithubJobs();
    assert.equal(
      (await githubTask(a, autoTask.id)).link?.error,
      "github_create_uncertain",
    );
    list = await getList(a, list.id);
    await githubRetry(a, { ...write(list), taskId: autoTask.id });
    await processGithubJobs();
    assert.equal(created, 3);
    assert.equal(issues[2].state, "closed");
    assert.equal((await githubTask(a, autoTask.id)).link?.issueNumber, 3);
    list = await getList(a, list.id);
    list = await updateTask(a, {
      ...write(list),
      taskId: autoTask.id,
      status: "in_progress",
      content: "**Shared description**",
    });
    await processGithubJobs();
    assert.equal(issues[2].state, "open");
    assert.ok(issues[2].body.includes("**Shared description**"));
    issues[2].state = "closed";
    issues[2].body = "Changed description on GitHub";
    const autoPayload = JSON.stringify({
      installation: { id: 500 },
      repository: { id: 600 },
      issue: { number: 3 },
    });
    const autoSignature = `sha256=${createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(autoPayload).digest("hex")}`;
    await githubWebhook(
      autoPayload,
      autoSignature,
      crypto.randomUUID(),
      "issues",
    );
    await processGithubJobs();
    list = await getList(a, list.id);
    assert.equal(list.tasks.find((t) => t.id === autoTask.id)!.status, "done");
    assert.equal(
      list.tasks.find((t) => t.id === autoTask.id)!.content,
      "Changed description on GitHub",
    );
    issues[2].state = "open";
    await githubWebhook(
      autoPayload,
      autoSignature,
      crypto.randomUUID(),
      "issues",
    );
    await processGithubJobs();
    list = await getList(a, list.id);
    assert.equal(list.tasks.find((t) => t.id === autoTask.id)!.status, "todo");
    list = await createTask(a, {
      ...write(list),
      title: "Local subtask",
      parentTaskId: autoTask.id,
    });
    const child = list.tasks.find((t) => t.title === "Local subtask")!;
    assert.equal((await githubTask(a, child.id)).link, null);
    // Unlink is persistent; ordinary edits never silently recreate the link.
    await githubUnlink(a, { ...write(list), taskId: autoTask.id });
    list = await getList(a, list.id);
    list = await updateTask(a, {
      ...write(list),
      taskId: autoTask.id,
      title: "Unlinked task",
    });
    assert.equal((await githubTask(a, autoTask.id)).link, null);
    // Older clients omitting the option preserve the owner's selection.
    await githubBind(a, { ...bind, ...write(list) });
    assert.equal((await githubList(a, list.id)).binding.autoCreateIssues, true);
    list = await getList(a, list.id);
    await githubUnbind(a, write(list));
    list = await getList(a, list.id);
    list = await createTask(a, { ...write(list), title: "Stopped automation" });
    assert.equal(
      (
        await githubTask(
          a,
          list.tasks.find((t) => t.title === "Stopped automation")!.id,
        )
      ).link,
      null,
    );
    await githubBind(a, { ...bind, ...write(list), autoCreateIssues: false });
    list = await getList(a, list.id);
    list = await createTask(a, {
      ...write(list),
      title: "Manual linking again",
    });
    assert.equal(
      (
        await githubTask(
          a,
          list.tasks.find((t) => t.title === "Manual linking again")!.id,
        )
      ).link,
      null,
    );
    await processGithubJobs();
    assert.equal(created, 3);
    await assert.rejects(
      updateTask(
        { ...a, scopes: ["lists:read", "tasks:write"] },
        {
          ...write(await getList(a, list.id)),
          taskId: task.id,
          title: "Unconsented external edit",
        },
      ),
      { code: "github_permission_required" },
    );
    list = await getList(a, list.id);
    const revoked = JSON.stringify({
        action: "deleted",
        installation: { id: 500 },
      }),
      sig = `sha256=${createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(revoked).digest("hex")}`;
    await githubWebhook(revoked, sig, crypto.randomUUID(), "installation");
    await githubRetry(a, { ...write(list), taskId: task.id });
    await processGithubJobs();
    assert.equal((await githubTask(a, task.id)).link?.error, "github_inactive");
    assert.equal(created, 3);
  } finally {
    await deleteList(a, {
      ...write(await getList(a, list.id)),
      confirmed: true,
    });
    await database().pool.query(
      "delete from wuff_github_accounts where user_id=$1",
      [a.id],
    );
    await database().pool.query(
      "delete from wuff_mutation_receipts where actor_id=any($1::text[])",
      [[a.id, b.id]],
    );
    await database().pool.query(
      "delete from wuff_users where id=any($1::text[])",
      [[a.id, b.id]],
    );
    globalThis.fetch = oldFetch;
    process.env = oldEnv;
  }
});
