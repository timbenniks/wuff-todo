import { test, after } from "node:test";
import assert from "node:assert/strict";
import { database } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  deleteList,
  cursorConnect,
  cursorConnection,
  cursorEnvironments,
  bindCursorEnvironment,
  cursorReadiness,
  launchAgent,
  messageAgent,
  agentTask,
  processAgentJobs,
  cancelAgent,
  setCursorSecret,
  agentActivity,
  recoverAgentRun,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
after(() => database().pool.end());
test("Cursor owner isolation, secrets, concurrent launches, lost responses, follow-ups and cancellation (mock provider)", async () => {
  const owner = { id: crypto.randomUUID(), scopes },
    stranger = { id: crypto.randomUUID(), scopes };
  const env = crypto.randomUUID(),
    repo = "synthetic-owner/agent-test";
  const oldFetch = globalThis.fetch,
    oldEnv = { ...process.env };
  process.env.CURSOR_TOKEN_SECRET = crypto.randomUUID();
  process.env.CURSOR_EXECUTION_ENABLED = "true";
  const providerAgents = new Map<string, any>(),
    providerRuns = new Map<string, any>();
  let initialPosts = 0,
    followupPosts = 0,
    loseInitial = true,
    loseFollowup = false,
    secretConfigured = false;
  let listId: string | undefined;
  let validationStatus = 200;
  const write = async () => {
    const l = await getList(owner, listId!);
    return {
      listId: l.id,
      version: l.version,
      operationId: crypto.randomUUID(),
    };
  };
  const release = () =>
    database().pool.query(
      "update wuff_agent_runs set lease_until=null where actor_id=$1",
      [owner.id],
    );
  globalThis.fetch = async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.cursor.com");
    assert.equal((init?.headers as any).Authorization, "Bearer synthetic-key");
    const path = url.pathname.replace("/v1", "");
    if (path === "/me")
      return Response.json(
        { id: "synthetic-cursor" },
        { status: validationStatus },
      );
    if (path === "/environments")
      return Response.json({
        items: [
          {
            id: env,
            name: "Development",
            repos: [{ url: `https://github.com/${repo}` }],
          },
        ],
      });
    if (path === `/environments/${env}`)
      return Response.json({
        id: env,
        name: "Development",
        repos: [{ url: `https://github.com/${repo}` }],
      });
    if (path === `/environments/${env}/secrets`)
      return Response.json({
        items: secretConfigured
          ? [{ name: "TEST_TOKEN", repos: [`github.com/${repo}`] }]
          : [],
      });
    if (path === `/environments/${env}/secrets/TEST_TOKEN`) {
      assert.equal(init?.method, "PUT");
      secretConfigured = true;
      return Response.json({ name: "TEST_TOKEN" });
    }
    if (path === "/agents") {
      const body = JSON.parse(String(init?.body));
      initialPosts++;
      if (providerAgents.has(body.agentId))
        return new Response(null, { status: 409 });
      assert.equal(body.workOnCurrentBranch, false);
      assert.equal(body.mode, "plan");
      const run = {
        id: `run-${crypto.randomUUID()}`,
        agentId: body.agentId,
        status: "RUNNING",
      };
      providerAgents.set(body.agentId, {
        id: body.agentId,
        latestRunId: run.id,
      });
      providerRuns.set(run.id, run);
      if (loseInitial) {
        loseInitial = false;
        throw Error("Synthetic lost response");
      }
      return Response.json({ agent: providerAgents.get(body.agentId), run });
    }
    const parts = path.split("/");
    if (parts[1] === "agents") {
      const agent = providerAgents.get(parts[2]);
      if (!agent) return new Response(null, { status: 404 });
      if (parts.length === 3) return Response.json(agent);
      if (parts.length === 4 && parts[3] === "runs") {
        followupPosts++;
        const run = {
          id: `run-${crypto.randomUUID()}`,
          agentId: agent.id,
          status: "RUNNING",
          createdAt: new Date().toISOString(),
        };
        agent.latestRunId = run.id;
        providerRuns.set(run.id, run);
        if (loseFollowup) throw Error("Synthetic lost follow-up");
        return Response.json({ run });
      }
      const run = providerRuns.get(parts[4]);
      if (!run) return new Response(null, { status: 404 });
      if (parts[5] === "cancel") {
        run.status = "CANCELLED";
        return Response.json(run);
      }
      if (parts[5] === "stream")
        return new Response(
          `id: event-1\nevent: tool_call\ndata: {"name":"shell","status":"completed","args":{"secret":"must-not-leak"}}\n\nid: event-2\nevent: assistant\ndata: {"text":"Working"}\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        );
      return Response.json(run);
    }
    throw Error("Unexpected provider path");
  };
  try {
    for (const a of [owner, stranger])
      await database().pool.query(
        "insert into wuff_users(id,email,name) values($1,$2,'Synthetic agent test')",
        [a.id, `${a.id}@example.invalid`],
      );
    const list = await createList(owner, {
      title: "Synthetic Cursor",
      mode: "work",
      operationId: crypto.randomUUID(),
    });
    listId = list.id;
    await database().pool.query(
      "insert into wuff_github_bindings(list_id,owner_id,installation_id,repository_id,repository) values($1,$2,'fake-install','fake-repo',$3)",
      [listId, owner.id, repo],
    );
    assert.equal((await cursorConnection(owner)).executionEnabled, true);
    assert.equal((await cursorConnection(owner)).connected, false);
    assert.equal((await cursorConnection(stranger)).connected, false);
    assert.equal((await cursorConnection(stranger)).configured, true);
    await assert.rejects(cursorEnvironments(owner, listId), {
      code: "cursor_connect",
    });
    validationStatus = 401;
    await assert.rejects(cursorConnect(stranger, "synthetic-key"), {
      code: "cursor_invalid_key",
      status: 400,
    });
    assert.equal((await cursorConnection(stranger)).connected, false);
    validationStatus = 200;
    await cursorConnect(stranger, "  synthetic-key\n");
    assert.equal((await cursorConnection(stranger)).connected, true);
    assert.equal((await cursorConnection(owner)).connected, false);
    const storedKey = (
      await database().pool.query(
        "select credentials from wuff_agent_accounts where user_id=$1",
        [stranger.id],
      )
    ).rows[0].credentials;
    assert.notEqual(storedKey, "synthetic-key");
    assert.ok(!storedKey.includes("synthetic-key"));
    assert.ok(
      !JSON.stringify(await cursorConnection(stranger)).includes(storedKey),
    );
    await cursorConnect(owner, "synthetic-key");
    assert.equal(
      (await cursorConnection(owner)).setupPath,
      "/connections#cursor",
    );
    assert.ok(
      (await cursorEnvironments(owner, listId)).environments.length > 0,
    );
    await assert.rejects(
      bindCursorEnvironment(stranger, {
        ...(await write()),
        environmentId: env,
        shareWithList: true,
      }),
      { code: "not_found" },
    );
    await bindCursorEnvironment(owner, {
      ...(await write()),
      environmentId: env,
      requiredSecrets: ["TEST_TOKEN"],
      shareWithList: true,
    });
    assert.deepEqual((await cursorReadiness(owner, listId)).missingSecrets, [
      "TEST_TOKEN",
    ]);
    const withTask = await createTask(owner, {
      ...(await write()),
      title: "Build a feature",
      content: "Acceptance criteria.",
    });
    const task = withTask.tasks[0];
    const start = { ...(await write()), taskId: task.id, confirmed: true };
    await assert.rejects(launchAgent(owner, start), {
      code: "cursor_not_ready",
    });
    await setCursorSecret(
      owner,
      listId,
      "TEST_TOKEN",
      "synthetic-environment-secret",
    );
    const readiness = await cursorReadiness(owner, listId);
    assert.equal(readiness.ready, true);
    assert.equal(
      JSON.stringify(readiness).includes("synthetic-environment-secret"),
      false,
    );
    await assert.rejects(
      launchAgent(
        { ...owner, scopes: ["lists:read", "lists:manage", "tasks:write"] },
        start,
      ),
      { code: "forbidden" },
    );
    await Promise.all([launchAgent(owner, start), launchAgent(owner, start)]);
    assert.equal((await agentTask(owner, task.id)).runs.length, 1);
    await assert.rejects(launchAgent(owner, { ...start, message: "changed" }), {
      code: "idempotency_conflict",
    });
    await assert.rejects(deleteList(owner, await write()), {
      code: "agent_active",
    });
    await processAgentJobs(1);
    assert.equal(initialPosts, 1);
    await release();
    await processAgentJobs(1);
    assert.equal(
      initialPosts,
      1,
      "lost launch response recovered without duplicate POST",
    );
    let state = await agentTask(owner, task.id);
    assert.equal(state.runs[0].status, "RUNNING");
    await assert.rejects(
      messageAgent(owner, {
        ...(await write()),
        taskId: task.id,
        message: "Also support keyboard",
        confirmed: true,
      }),
      { code: "agent_busy" },
    );
    await assert.rejects(agentTask(stranger, task.id), { code: "not_found" });
    await database().pool.query(
      "insert into wuff_members(list_id,user_id) values($1,$2)",
      [listId, stranger.id],
    );
    assert.equal((await agentTask(stranger, task.id)).runs.length, 1);
    await assert.rejects(
      messageAgent(stranger, {
        ...(await write()),
        taskId: task.id,
        message: "Spend owner's money",
        confirmed: true,
      }),
      { code: "owner_required" },
    );
    await assert.rejects(agentActivity(stranger, task.id, state.runs[0].id), {
      code: "owner_required",
    });
    const activity = await agentActivity(owner, task.id, state.runs[0].id);
    assert.equal(JSON.stringify(activity).includes("must-not-leak"), false);
    assert.equal(activity.cursor, "event-2");
    await cancelAgent(owner, {
      taskId: task.id,
      runId: state.runs[0].id,
      operationId: crypto.randomUUID(),
    });
    await release();
    await processAgentJobs(1);
    state = await agentTask(owner, task.id);
    assert.equal(state.runs[0].status, "CANCELLED");
    const reply = {
      ...(await write()),
      taskId: task.id,
      message: "Please plan keyboard support",
      mode: "plan",
      confirmed: true,
    };
    await messageAgent(owner, reply);
    await messageAgent(owner, reply);
    loseFollowup = true;
    await processAgentJobs(1);
    await release();
    await processAgentJobs(1);
    assert.equal(
      followupPosts,
      1,
      "uncertain follow-up is never blindly replayed",
    );
    state = await agentTask(owner, task.id);
    assert.equal(state.runs.at(-1)!.status, "uncertain");
    await assert.rejects(
      messageAgent(owner, {
        ...(await write()),
        taskId: task.id,
        message: "another",
        confirmed: true,
      }),
      { code: "agent_busy" },
    );
    const lost = state.runs.at(-1)!;
    const providerRunId = providerAgents.get(
      state.conversation!.agentId,
    ).latestRunId;
    await recoverAgentRun(owner, {
      taskId: task.id,
      runId: lost.id,
      providerRunId,
      confirmed: true,
      operationId: crypto.randomUUID(),
    });
    assert.equal(
      (await agentTask(owner, task.id)).runs.at(-1)!.status,
      "RUNNING",
    );
    await cancelAgent(owner, {
      taskId: task.id,
      runId: lost.id,
      operationId: crypto.randomUUID(),
    });
    await release();
    await processAgentJobs(1);
    assert.equal(
      (await agentTask(owner, task.id)).runs.at(-1)!.status,
      "CANCELLED",
    );
    await database().pool.query(
      "delete from wuff_members where list_id=$1 and user_id=$2",
      [listId, stranger.id],
    );
    await assert.rejects(agentTask(stranger, task.id), { code: "not_found" });
  } finally {
    if (listId) {
      await database().pool.query(
        "delete from wuff_agent_runs where actor_id=$1",
        [owner.id],
      );
      await deleteList(owner, await write());
    }
    await database().pool.query(
      "delete from wuff_mutation_receipts where actor_id=any($1::text[])",
      [[owner.id, stranger.id]],
    );
    await database().pool.query(
      "delete from wuff_users where id=any($1::text[])",
      [[owner.id, stranger.id]],
    );
    globalThis.fetch = oldFetch;
    process.env = oldEnv;
  }
});
