import { reviewState, checkState } from "./github-pr-policy";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  createSign,
} from "node:crypto";
import { database } from "@wuff/db";
import {
  AppError,
  githubBindingSchema,
  githubLinkSchema,
  githubResolveSchema,
  githubTaskSchema,
  scopes,
  type Actor,
  type GithubSyncFields,
  type GithubPullRequest,
} from "@wuff/contracts";
import {
  githubSafeFields,
  mergeGithub,
  sameGithubFields,
  verifyGithubSignature,
} from "./github-policy";

type Client = Pick<ReturnType<typeof database>["pool"], "query">;
const db = () => database().pool;
const fail = (code: string, message: string, status = 409): never => {
  throw new AppError(code, message, status);
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function setting(name: string) {
  return (
    process.env[name] ||
    fail("github_unconfigured", "GitHub connection is not configured yet.", 503)
  );
}
function seal(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(hash(setting("GITHUB_TOKEN_SECRET")), "hex"),
      iv,
    );
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
function unseal<T>(value: string): T {
  const bytes = Buffer.from(value, "base64url"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(hash(setting("GITHUB_TOKEN_SECRET")), "hex"),
      bytes.subarray(0, 12),
    );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString(),
  );
}
async function tx<T>(fn: (client: Client) => Promise<T>) {
  const c = await db().connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
async function githubMutation(
  actor: Actor,
  input: { listId: string; operationId: string },
  kind: string,
  owner: boolean,
  fn: (c: Client) => Promise<void>,
) {
  return tx(async (c) => {
    githubPermission(actor);
    if ("taskId" in input)
      await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        `github:${String(input.taskId)}`,
      ]);
    await access(c, actor, input.listId, owner);
    await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      actor.id + ":" + input.operationId,
    ]);
    const fingerprint = hash(JSON.stringify({ kind, ...input }));
    const {
      rows: [receipt],
    } = await c.query(
      "select fingerprint from wuff_mutation_receipts where actor_id=$1 and operation_id=$2",
      [actor.id, input.operationId],
    );
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        fail(
          "idempotency_conflict",
          "This operation identity was used for another request.",
        );
      return;
    }
    await fn(c);
    await c.query(
      "insert into wuff_mutation_receipts(actor_id,operation_id,fingerprint,result) values($1,$2,$3,$4)",
      [
        actor.id,
        input.operationId,
        fingerprint,
        JSON.stringify({ id: input.listId }),
      ],
    );
  });
}
async function admitted(c: Client, actor: Actor, scope = "lists:read") {
  if (!actor.scopes.includes(scope))
    fail("forbidden", "This connection does not permit that action.", 403);
  if (
    !(
      await c.query("select id from wuff_users where id=$1 and enabled", [
        actor.id,
      ])
    ).rowCount
  )
    fail("invite_required", "An invitation is required.", 403);
}
async function access(
  c: Client,
  actor: Actor,
  listId: string,
  owner = false,
  version?: number,
) {
  await admitted(
    c,
    actor,
    version === undefined ? "lists:read" : "tasks:write",
  );
  const r = await c.query(
    "select l.* from wuff_lists l where id=$1 and (owner_id=$2 or exists(select 1 from wuff_members m where m.list_id=l.id and m.user_id=$2)) for update",
    [listId, actor.id],
  );
  const list = r.rows[0];
  if (!list) fail("not_found", "List not found.", 404);
  if (
    owner &&
    (list.owner_id !== actor.id || !actor.scopes.includes("lists:manage"))
  )
    fail(
      "owner_required",
      "Only the list owner can manage GitHub connections.",
      403,
    );
  if (version !== undefined && list.version !== version)
    fail("conflict", "This list changed. Reload and try again.");
  if (version !== undefined && (list.archived || list.mode !== "work"))
    fail("github_work_list", "Use an active Work list for GitHub changes.");
  return list;
}
async function provider<T = any>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const code =
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
        ? "github_access_unavailable"
        : response.status === 412
          ? "github_conflict"
          : "github_retry";
    fail(
      code,
      code === "github_access_unavailable"
        ? "GitHub access is unavailable. Check the installation and reconnect."
        : "GitHub could not finish this operation. Retry or reconcile it.",
      502,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
async function exchange(form: Record<string, string>) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: setting("GITHUB_APP_CLIENT_ID"),
      client_secret: setting("GITHUB_APP_CLIENT_SECRET"),
      ...form,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const known = [
      "bad_verification_code",
      "incorrect_client_credentials",
      "redirect_uri_mismatch",
      "bad_refresh_token",
      "unsupported_grant_type",
    ];
    const reason = known.includes(data.error) ? data.error : "exchange_failed";
    fail(
      `github_oauth_${reason}`,
      "GitHub authorization could not be exchanged. Reconnect.",
      401,
    );
  }
  return data;
}
function githubPermission(actor: Actor) {
  if (!actor.scopes.includes("github:manage"))
    fail(
      "forbidden",
      "Reconnect this client with explicit GitHub permission.",
      403,
    );
}
async function userToken(actor: Actor) {
  githubPermission(actor);
  return tx(async (c) => {
    await admitted(c, actor);
    const {
      rows: [a],
    } = await c.query(
      "select * from wuff_github_accounts where user_id=$1 for update",
      [actor.id],
    );
    if (!a) fail("github_reconnect", "Connect your GitHub account first.");
    let credentials = unseal<{ access_token: string; refresh_token: string }>(
      a.credentials,
    );
    if (new Date(a.expires_at).getTime() < Date.now() + 60000) {
      const tokens = await exchange({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
      });
      credentials = tokens;
      await c.query(
        "update wuff_github_accounts set credentials=$2,expires_at=$3 where user_id=$1",
        [
          actor.id,
          seal(tokens),
          new Date(Date.now() + tokens.expires_in * 1000),
        ],
      );
    }
    return { token: credentials.access_token, githubId: a.github_id };
  });
}
function jwt() {
  const now = Math.floor(Date.now() / 1000),
    head = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
      "base64url",
    ),
    body = Buffer.from(
      JSON.stringify({
        iat: now - 60,
        exp: now + 480,
        iss: setting("GITHUB_APP_CLIENT_ID"),
      }),
    ).toString("base64url");
  const value = `${head}.${body}`;
  const signer = createSign("RSA-SHA256");
  signer.update(value);
  return `${value}.${signer.sign(Buffer.from(setting("GITHUB_APP_PRIVATE_KEY_BASE64"), "base64").toString(), "base64url")}`;
}
async function installationToken(
  installation: string,
  repoId: string,
  ownerId: string,
) {
  if (process.env.GITHUB_APP_PRIVATE_KEY_BASE64) {
    const result = await provider(
      `/app/installations/${installation}/access_tokens`,
      jwt(),
      {
        method: "POST",
        body: JSON.stringify({ repository_ids: [Number(repoId)] }),
      },
    );
    return result.token as string;
  }
  // GitHub App user tokens are also supported. Recheck both the installation
  // and the owner's repository authority on every reconciliation, never infer
  // access from a previously saved installation ID.
  if (!ownerId) fail("github_reconnect", "Reconnect the repository owner.");
  const actor = { id: ownerId, scopes };
  const { token } = await userToken(actor);
  const available = await githubRepositories(actor);
  if (
    !available.repositories.some(
      (r: any) =>
        String(r.installationId) === installation &&
        String(r.repositoryId) === repoId,
    )
  )
    fail("github_access_unavailable", "Repository access was revoked.");
  return token;
}
export async function githubStart(actor: Actor, origin: string) {
  githubPermission(actor);
  await admitted(db(), actor, "lists:manage");
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  await db().query(
    "insert into wuff_github_auth_states(hash,user_id,verifier,expires_at) values($1,$2,$3,now()+interval '10 minutes')",
    [hash(state), actor.id, seal(verifier)],
  );
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: setting("GITHUB_APP_CLIENT_ID"),
    redirect_uri: `${origin}/api/github/callback`,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    allow_signup: "false",
    scope: "offline_access",
  }).toString();
  return { url: url.href };
}
export async function githubCallback(
  actor: Actor,
  code: string,
  state: string,
  origin: string,
) {
  await admitted(db(), actor, "lists:manage");
  const result = await db().query(
    "delete from wuff_github_auth_states where hash=$1 and user_id=$2 and expires_at>now() returning verifier",
    [hash(state), actor.id],
  );
  if (!result.rowCount)
    fail(
      "github_state",
      "GitHub authorization could not be verified. Start again.",
      400,
    );
  const tokens = await exchange({
    code,
    state,
    code_verifier: unseal<string>(result.rows[0].verifier),
    redirect_uri: `${origin}/api/github/callback`,
  });
  const user = await provider("/user", tokens.access_token);
  await db().query(
    "insert into wuff_github_accounts(user_id,github_id,login,credentials,expires_at) values($1,$2,$3,$4,$5) on conflict(user_id) do update set github_id=excluded.github_id,login=excluded.login,credentials=excluded.credentials,expires_at=excluded.expires_at",
    [
      actor.id,
      String(user.id),
      user.login,
      seal(tokens),
      new Date(Date.now() + (tokens.expires_in ?? 28800) * 1000),
    ],
  );
}
export async function githubConnections(actor: Actor) {
  githubPermission(actor);
  await admitted(db(), actor);
  const {
    rows: [account],
  } = await db().query(
    "select login from wuff_github_accounts where user_id=$1",
    [actor.id],
  );
  const { rows: bindings } = await db().query(
    'select b.list_id as "listId",b.repository,b.active,b.auto_create_issues as "autoCreateIssues" from wuff_github_bindings b join wuff_lists l on l.id=b.list_id where l.owner_id=$1',
    [actor.id],
  );
  return {
    configured: !!process.env.GITHUB_APP_CLIENT_SECRET,
    account: account?.login ?? null,
    bindings,
    installUrl: "https://github.com/apps/wuff-todo/installations/new",
  };
}
export async function githubRepositories(actor: Actor) {
  const { token, githubId } = await userToken(actor);
  const installations = await provider(
    "/user/installations?per_page=100",
    token,
  );
  const repositories = [];
  for (const i of installations.installations.filter(
    (i: any) =>
      String(i.app_id) === setting("GITHUB_APP_ID") &&
      String(i.account.id) === githubId &&
      !i.suspended_at,
  )) {
    for (let page = 1; page <= 10; page++) {
      const r = await provider(
        `/user/installations/${i.id}/repositories?per_page=100&page=${page}`,
        token,
      );
      repositories.push(
        ...r.repositories
          .filter((r: any) => r.permissions?.admin)
          .map((r: any) => ({
            installationId: i.id,
            repositoryId: r.id,
            name: r.full_name,
            private: r.private,
          })),
      );
      if (r.repositories.length < 100) break;
    }
  }
  return { repositories };
}
export async function githubBind(actor: Actor, data: unknown) {
  const input = githubBindingSchema.parse(data);
  await tx((c) => access(c, actor, input.listId, true));
  const available = await githubRepositories(actor),
    repo = available.repositories.find(
      (r: any) =>
        r.repositoryId === input.repositoryId &&
        r.installationId === input.installationId,
    );
  if (!repo)
    fail(
      "github_repository",
      "Choose a repository you administer in your verified personal installation.",
      403,
    );
  await githubMutation(actor, input, "github_bind", true, async (c) => {
    await access(c, actor, input.listId, true, input.version);
    const {
      rows: [existing],
    } = await c.query(
      "select repository_id,installation_id from wuff_github_bindings where list_id=$1",
      [input.listId],
    );
    if (
      (
        await c.query(
          "select 1 from wuff_github_links where list_id=$1 limit 1",
          [input.listId],
        )
      ).rowCount &&
      existing?.repository_id !== String(repo.repositoryId)
    )
      fail("github_linked", "Unlink tasks before changing the repository.");
    await c.query(
      "insert into wuff_github_bindings(list_id,owner_id,installation_id,repository_id,repository,auto_create_issues) values($1,$2,$3,$4,$5,coalesce($6,false)) on conflict(list_id) do update set owner_id=excluded.owner_id,installation_id=excluded.installation_id,repository_id=excluded.repository_id,repository=excluded.repository,auto_create_issues=coalesce($6,wuff_github_bindings.auto_create_issues),active=true",
      [
        input.listId,
        actor.id,
        String(repo.installationId),
        String(repo.repositoryId),
        repo.name,
        input.autoCreateIssues ?? null,
      ],
    );
    await c.query("update wuff_lists set version=version+1 where id=$1", [
      input.listId,
    ]);
  });
  return githubList(actor, input.listId);
}
export async function githubList(actor: Actor, listId: string) {
  return tx(async (c) => {
    await access(c, actor, listId);
    const {
      rows: [binding],
    } = await c.query(
      'select repository,active,auto_create_issues as "autoCreateIssues" from wuff_github_bindings where list_id=$1',
      [listId],
    );
    return { binding: binding ?? null };
  });
}
export async function githubUnbind(actor: Actor, data: unknown) {
  const input = githubTaskSchema.omit({ taskId: true }).parse(data);
  await githubMutation(actor, input, "github_unbind", true, async (c) => {
    await access(c, actor, input.listId, true, input.version);
    if (
      (
        await c.query(
          `select 1 from wuff_agent_runs r join wuff_tasks t on t.id=r.task_id
      where t.list_id=$1 and r.status not in ('FINISHED','ERROR','CANCELLED','EXPIRED') limit 1`,
          [input.listId],
        )
      ).rowCount
    )
      fail(
        "agent_active",
        "Stop active agents and resolve uncertain deliveries before disconnecting their repository.",
      );
    await c.query(
      "update wuff_github_bindings set active=false where list_id=$1",
      [input.listId],
    );
    await c.query("update wuff_lists set version=version+1 where id=$1", [
      input.listId,
    ]);
  });
  return { disconnected: true };
}
export async function githubTask(actor: Actor, taskId: string) {
  return tx(async (c) => {
    const {
      rows: [task],
    } = await c.query("select list_id from wuff_tasks where id=$1", [taskId]);
    if (!task) fail("not_found", "Task not found.", 404);
    await access(c, actor, task.list_id);
    const {
      rows: [link],
    } = await c.query(
      'select g.task_id as "taskId",g.issue_number as "issueNumber",g.state,g.revision,g.conflict,g.error,b.repository,b.active from wuff_github_links g left join wuff_github_bindings b on b.list_id=g.list_id where task_id=$1',
      [taskId],
    );
    return {
      link: link
        ? {
            ...link,
            url: link.issueNumber
              ? `https://github.com/${link.repository}/issues/${link.issueNumber}`
              : null,
          }
        : null,
    };
  });
}
async function context(c: Client, taskId: string) {
  const {
    rows: [v],
  } = await c.query(
    "select t.*,l.owner_id,l.archived,l.mode,l.version as list_version,b.installation_id,b.repository_id,b.repository,b.active,u.enabled from wuff_tasks t join wuff_lists l on l.id=t.list_id join wuff_github_bindings b on b.list_id=l.id join wuff_users u on u.id=l.owner_id where t.id=$1",
    [taskId],
  );
  if (!v || !v.active || !v.enabled || v.archived || v.mode !== "work")
    fail(
      "github_inactive",
      "Restore this list or reconnect its repository before syncing.",
    );
  return v;
}
const localFields = (v: any): GithubSyncFields =>
  githubSafeFields({ title: v.title, body: v.content, closed: v.completed });
function remoteFields(v: any): GithubSyncFields {
  if (v.pull_request)
    fail("github_issue", "Choose an issue, not a pull request.");
  return githubSafeFields({
    title: v.title,
    body: v.body ?? "",
    closed: v.state === "closed",
  });
}
async function queue(c: Client, taskId: string) {
  await c.query(
    "insert into wuff_github_jobs(id,task_id) values($1,$2) on conflict(id) do update set generation=wuff_github_jobs.generation+1,available_at=now(),attempts=0",
    [`task:${taskId}`, taskId],
  );
}
export async function githubLink(actor: Actor, data: unknown) {
  const input = githubLinkSchema.parse(data);
  await githubMutation(actor, input, "github_link", true, async (c) => {
    await access(c, actor, input.listId, true, input.version);
    const v = await context(c, input.taskId);
    if (v.list_id !== input.listId) fail("not_found", "Task not found.", 404);
    localFields(v);
    const {
      rows: [old],
    } = await c.query("select * from wuff_github_links where task_id=$1", [
      input.taskId,
    ]);
    if (old) {
      if (
        old.operation_id === input.operationId &&
        old.issue_number === (input.issueNumber ?? null)
      )
        return;
      fail("github_linked", "This task already has a GitHub issue.");
    }
    await c.query(
      "insert into wuff_github_links(task_id,list_id,repository_id,issue_number,operation_id) values($1,$2,$3,$4,$5)",
      [
        input.taskId,
        input.listId,
        v.repository_id,
        input.issueNumber ?? null,
        input.operationId,
      ],
    );
    await queue(c, input.taskId);
    await c.query("update wuff_lists set version=version+1 where id=$1", [
      input.listId,
    ]);
  });
  return githubTask(actor, input.taskId);
}
export async function githubUnlink(actor: Actor, data: unknown) {
  const input = githubTaskSchema.parse(data);
  await githubMutation(actor, input, "github_unlink", true, async (c) => {
    await access(c, actor, input.listId, true, input.version);
    await c.query(
      "delete from wuff_github_links where task_id=$1 and list_id=$2",
      [input.taskId, input.listId],
    );
    await c.query("delete from wuff_github_jobs where task_id=$1", [
      input.taskId,
    ]);
    await c.query("update wuff_lists set version=version+1 where id=$1", [
      input.listId,
    ]);
  });
  return { unlinked: true };
}
export async function githubRetry(actor: Actor, data: unknown) {
  const input = githubTaskSchema.parse(data);
  await githubMutation(actor, input, "github_retry", false, async (c) => {
    await access(c, actor, input.listId, false, input.version);
    const {
      rows: [link],
    } = await c.query(
      "select * from wuff_github_links where task_id=$1 and list_id=$2",
      [input.taskId, input.listId],
    );
    if (!link) fail("not_found", "GitHub link not found.", 404);
    await queue(c, input.taskId);
  });
  return githubTask(actor, input.taskId);
}
export async function githubResolve(actor: Actor, data: unknown) {
  const input = githubResolveSchema.parse(data);
  await githubMutation(actor, input, "github_resolve", false, async (c) => {
    await access(c, actor, input.listId, false, input.version);
    const {
      rows: [link],
    } = await c.query(
      "select * from wuff_github_links where task_id=$1 and list_id=$2 for update",
      [input.taskId, input.listId],
    );
    if (!link || link.revision !== input.revision || !link.conflict)
      fail("conflict", "The sync conflict changed. Reload before resolving.");
    const v = await context(c, input.taskId);
    if (!sameGithubFields(localFields(v), link.conflict.wuff))
      fail(
        "conflict",
        "Task content changed. Reconcile again before resolving.",
      );
    const chosen =
      input.choice === "wuff" ? link.conflict.wuff : link.conflict.github;
    await c.query(
      "update wuff_tasks set title=$2,content=$3,completed=$4,status=case when $4 then 'done' else case when completed then 'todo' else status end end,completed_at=case when $4 then coalesce(completed_at,now()) else null end,updated_at=now() where id=$1",
      [input.taskId, chosen.title, chosen.body, chosen.closed],
    );
    await c.query(
      "update wuff_github_links set baseline=$2,conflict=null,state='pending',revision=revision+1 where task_id=$1",
      [input.taskId, JSON.stringify(link.conflict.github)],
    );
    await c.query("update wuff_lists set version=version+1 where id=$1", [
      input.listId,
    ]);
    await queue(c, input.taskId);
  });
  return githubTask(actor, input.taskId);
}
async function syncTask(taskId: string) {
  const {
    rows: [link],
  } = await db().query("select * from wuff_github_links where task_id=$1", [
    taskId,
  ]);
  if (!link) return;
  const v = await context(db(), taskId),
    local = localFields(v),
    token = await installationToken(
      v.installation_id,
      v.repository_id,
      v.owner_id,
    );
  const repository = await provider(`/repositories/${v.repository_id}`, token);
  if (String(repository.id) !== v.repository_id)
    fail("github_repository", "Repository identity changed.");
  v.repository = repository.full_name;
  await db().query(
    "update wuff_github_bindings set repository=$2 where list_id=$1 and repository_id=$3",
    [v.list_id, v.repository, v.repository_id],
  );
  const marker = `<!-- wuff-sync:${link.operation_id} -->`;
  let issue: any;
  if (!link.issue_number) {
    // A marker permits recovery after a successful create whose response was lost.
    for (let page = 1; page <= 5; page++) {
      const issues = await provider<any[]>(
        `/repos/${v.repository}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`,
        token,
      );
      issue = issues.find(
        (i) => !i.pull_request && (i.body ?? "").includes(marker),
      );
      if (issue || issues.length < 100) break;
    }
    if (!issue) {
      if (link.state === "creating" || link.error === "github_create_uncertain")
        fail(
          "github_create_uncertain",
          "Issue creation has an uncertain result. Reconcile the repository before creating another issue.",
        );
      await db().query(
        "update wuff_github_links set state='creating',baseline=$2 where task_id=$1",
        [taskId, JSON.stringify({ ...local, closed: false })],
      );
      try {
        issue = await provider(`/repos/${v.repository}/issues`, token, {
          method: "POST",
          body: JSON.stringify({
            title: local.title,
            body: `${local.body}\n\n${marker}`,
          }),
        });
      } catch {
        fail(
          "github_create_uncertain",
          "Issue creation may have reached GitHub. Retry to look for the existing issue; do not create a duplicate.",
        );
      }
    }
    await db().query(
      "update wuff_github_links set issue_number=$2,node_id=$3,baseline=$4,state='pending' where task_id=$1",
      [
        taskId,
        issue.number,
        issue.node_id,
        JSON.stringify(link.baseline ?? { ...local, closed: false }),
      ],
    );
    link.issue_number = issue.number;
    link.baseline = link.baseline ?? { ...local, closed: false };
  }
  issue = await provider(
    `/repos/${v.repository}/issues/${link.issue_number}`,
    token,
  );
  const remote = remoteFields({
    ...issue,
    body: (issue.body ?? "").replace(/\n*<!-- wuff-sync:[a-f0-9-]+ -->/g, ""),
  });
  const base = link.baseline as GithubSyncFields | null;
  let outcome = base
    ? mergeGithub(base, local, remote)
    : {
        merged: local,
        conflict: !sameGithubFields(local, remote),
      };
  // Resolving a stale remote value must surface another conflict, not force it.
  if (outcome.conflict) {
    await db().query(
      "update wuff_github_links set conflict=$2,state='conflict',error=null,revision=revision+1 where task_id=$1",
      [taskId, JSON.stringify({ wuff: local, github: remote })],
    );
    return;
  }
  const desired = githubSafeFields(outcome.merged);
  if (!sameGithubFields(desired, remote)) {
    await context(db(), taskId); // Check live owner/binding state immediately before the provider write.
    const check = await provider(
      `/repos/${v.repository}/issues/${link.issue_number}`,
      token,
    );
    if (check.updated_at !== issue.updated_at)
      fail(
        "github_conflict",
        "GitHub changed during reconciliation. Retry to compare again.",
      );
    issue = await provider(
      `/repos/${v.repository}/issues/${link.issue_number}`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: desired.title,
          body: `${desired.body}\n\n${marker}`,
          state: desired.closed ? "closed" : "open",
        }),
      },
    );
  }
  await tx(async (c) => {
    await c.query("select id from wuff_lists where id=$1 for update", [
      v.list_id,
    ]);
    const current = await context(c, taskId);
    const {
      rows: [still],
    } = await c.query(
      "select * from wuff_github_links where task_id=$1 for update",
      [taskId],
    );
    if (!still || still.operation_id !== link.operation_id) return;
    // Preserve writes that arrived while GitHub was being read/updated.
    if (sameGithubFields(localFields(current), local)) {
      await c.query(
        "update wuff_tasks set title=$2,content=$3,completed=$4,status=case when $4 then 'done' else case when completed then 'todo' else status end end,completed_at=case when $4 then coalesce(completed_at,now()) else null end,updated_at=case when title<>$2 or content<>$3 or completed<>$4 then now() else updated_at end where id=$1",
        [taskId, desired.title, desired.body, desired.closed],
      );
      if (!sameGithubFields(local, desired))
        await c.query("update wuff_lists set version=version+1 where id=$1", [
          v.list_id,
        ]);
    } else await queue(c, taskId);
    await c.query(
      "update wuff_github_links set baseline=$2,node_id=$3,conflict=null,state='synced',error=null,revision=revision+1 where task_id=$1",
      [taskId, JSON.stringify(desired), issue.node_id],
    );
  });
}
export async function processGithubJobs(limit = 8) {
  if (!process.env.GITHUB_APP_CLIENT_SECRET) return { processed: 0 };
  let processed = 0;
  const deadline = Date.now() + 45000;
  for (let n = 0; n < limit && Date.now() < deadline; n++) {
    const {
      rows: [job],
    } = await db().query(
      "update wuff_github_jobs set lease_until=now()+interval '90 seconds' where id=(select id from wuff_github_jobs where available_at<=now() and (lease_until is null or lease_until<now()) order by available_at for update skip locked limit 1) returning *,lease_until::text as lease_identity",
    );
    if (!job) break;
    const c = await db().connect();
    try {
      // Pin the pooled backend until the transaction-scoped lock is released.
      await c.query("begin");
      const {
        rows: [lock],
      } = await c.query(
        "select pg_try_advisory_xact_lock(hashtextextended($1,0)) as locked",
        [`github:${job.task_id}`],
      );
      if (!lock.locked) {
        // Another worker or mutation still owns this task. Do not strand its
        // next generation behind a lease for work we never started.
        await db().query(
          "update wuff_github_jobs set lease_until=null where id=$1 and lease_until=$2",
          [job.id, job.lease_identity],
        );
        await new Promise((resolve) => setTimeout(resolve, 250));
        n--;
        continue;
      }
      try {
        await syncTask(job.task_id);
        await db().query(
          "delete from wuff_github_jobs where id=$1 and generation=$2",
          [job.id, job.generation],
        );
        await db().query(
          "update wuff_github_jobs set lease_until=null where id=$1",
          [job.id],
        );
        processed++;
      } catch (e) {
        const code = e instanceof AppError ? e.code : "github_retry";
        await db().query(
          "update wuff_github_links set state='failed',error=$2,revision=revision+1 where task_id=$1",
          [job.task_id, code],
        );
        await db().query(
          "update wuff_github_jobs set attempts=attempts+1,available_at=case when attempts>=7 then 'infinity'::timestamptz else now()+ make_interval(secs=>least(86400,30*power(2,least(attempts,11)))) end,lease_until=null where id=$1",
          [job.id],
        );
      }
    } finally {
      try {
        await c.query("rollback");
      } finally {
        c.release();
      }
    }
  }
  return { processed };
}
export async function githubWebhook(
  body: string,
  signature: string,
  delivery: string,
  event: string,
) {
  if (Buffer.byteLength(body) > 262144)
    fail("too_large", "Webhook is too large.", 413);
  if (
    !/^[a-f0-9-]{1,100}$/i.test(delivery) ||
    !verifyGithubSignature(body, signature, setting("GITHUB_WEBHOOK_SECRET"))
  )
    fail("github_signature", "Webhook verification failed.", 401);
  let value: any;
  try {
    value = JSON.parse(body);
  } catch {
    fail("invalid_json", "Invalid webhook.", 400);
  }
  await tx(async (c) => {
    const result = await c.query(
      "insert into wuff_github_deliveries(id,digest) values($1,$2) on conflict do nothing returning id",
      [delivery, hash(body)],
    );
    if (!result.rowCount) {
      const {
        rows: [old],
      } = await c.query(
        "select digest from wuff_github_deliveries where id=$1",
        [delivery],
      );
      if (old.digest !== hash(body))
        fail("github_delivery", "Delivery identity mismatch.");
      return;
    }
    const installation = String(value.installation?.id ?? ""),
      repo = String(value.repository?.id ?? "");
    if (
      event === "installation" &&
      ["deleted", "suspend"].includes(value.action)
    )
      await c.query(
        "update wuff_github_bindings set active=false where installation_id=$1",
        [installation],
      );
    if (event === "installation_repositories" && value.action === "removed")
      for (const r of value.repositories_removed ?? [])
        await c.query(
          "update wuff_github_bindings set active=false where installation_id=$1 and repository_id=$2",
          [installation, String(r.id)],
        );
    if (event === "github_app_authorization" && value.action === "revoked")
      await c.query(
        "update wuff_github_bindings set active=false where owner_id in (select user_id from wuff_github_accounts where github_id=$1)",
        [String(value.sender?.id ?? "")],
      );
    if (
      [
        "pull_request",
        "pull_request_review",
        "check_run",
        "check_suite",
        "status",
      ].includes(event)
    ) {
      // A newly linked PR is not yet in our cache. Invalidate all issue-backed
      // tasks in this installation/repository; readers discover authoritative links.
      await c.query(
        `update wuff_github_pr_snapshots s set stale=true from wuff_github_links g
        join wuff_github_bindings b on b.list_id=g.list_id
        where s.task_id=g.task_id and b.repository_id=$1 and b.installation_id=$2 and b.active`,
        [repo, installation],
      );
      await c.query(
        `update wuff_lists set version=version+1 where id in
        (select list_id from wuff_github_bindings where repository_id=$1 and installation_id=$2 and active)`,
        [repo, installation],
      );
    }
    if (event === "issues" && value.issue?.number) {
      const { rows: links } = await c.query(
        "select g.task_id from wuff_github_links g join wuff_github_bindings b on b.list_id=g.list_id where g.repository_id=$1 and g.issue_number=$2 and b.installation_id=$3 and b.active",
        [repo, value.issue.number, installation],
      );
      for (const l of links) await queue(c, l.task_id);
    }
  });
  return { accepted: true };
}
export async function reconcileGithub() {
  // Preserve older queued jobs and their retry schedule, rather than repeatedly
  // resetting the first page and starving later tasks during daily recovery.
  await db().query(
    "insert into wuff_github_jobs(id,task_id) select 'task:'||g.task_id,g.task_id from wuff_github_links g join wuff_github_bindings b on g.list_id=b.list_id where b.active on conflict(id) do nothing",
  );
  await db().query(
    "delete from wuff_github_auth_states where expires_at<now()",
  );
  await db().query(
    "delete from wuff_github_deliveries where created_at<now()-interval '30 days'",
  );
  return processGithubJobs(8);
}
export async function githubPullRequests(actor: Actor, taskId: string) {
  githubPermission(actor);
  const { link } = await githubTask(actor, taskId);
  if (!link?.issueNumber) return { pullRequests: [] as GithubPullRequest[] };
  const v = await context(db(), taskId);
  const {
    rows: [cached],
  } = await db().query(
    "select * from wuff_github_pr_snapshots where task_id=$1 and repository_id=$2 and issue_number=$3",
    [taskId, v.repository_id, link.issueNumber],
  );
  if (
    cached &&
    !cached.stale &&
    Date.now() - new Date(cached.fetched_at).getTime() < 30000
  )
    return {
      pullRequests: cached.pull_requests as GithubPullRequest[],
      fetchedAt: cached.fetched_at,
    };
  const token = await installationToken(
    v.installation_id,
    v.repository_id,
    v.owner_id,
  );
  const numbers = new Set<number>();
  const agentLinks = await db().query(
    "select pull_request_urls from wuff_agent_runs where task_id=$1",
    [taskId],
  );
  for (const row of agentLinks.rows)
    for (const url of row.pull_request_urls ?? []) {
      const prefix = `https://github.com/${v.repository}/pull/`;
      if (
        typeof url === "string" &&
        url.startsWith(prefix) &&
        /^[1-9][0-9]*$/.test(url.slice(prefix.length))
      )
        numbers.add(Number(url.slice(prefix.length)));
    }
  // Bounded pagination reports truncation instead of silently treating a partial
  // history as complete. Only same-repository references are eligible.
  let truncated = false;
  for (let page = 1; page <= 5; page++) {
    const events = await provider<any[]>(
      `/repos/${v.repository}/issues/${link.issueNumber}/timeline?per_page=100&page=${page}`,
      token,
    );
    for (const e of events) {
      const issue = e.source?.issue;
      if (
        e.event === "cross-referenced" &&
        issue?.pull_request &&
        (issue.repository?.id === Number(v.repository_id) ||
          issue.repository_url ===
            `https://api.github.com/repos/${v.repository}`) &&
        Number.isSafeInteger(issue.number)
      )
        numbers.add(issue.number);
    }
    if (events.length < 100) break;
    if (page === 5) truncated = true;
  }
  const pullRequests: GithubPullRequest[] = [];
  if (numbers.size > 20) truncated = true;
  for (const number of [...numbers].slice(-20)) {
    const p = await provider(`/repos/${v.repository}/pulls/${number}`, token);
    if (String(p.base?.repo?.id) !== v.repository_id) continue;
    let review: GithubPullRequest["review"] = "unavailable";
    let checks: GithubPullRequest["checks"] = "unavailable";
    try {
      const reviews = await provider<any[]>(
        `/repos/${v.repository}/pulls/${number}/reviews?per_page=100`,
        token,
      );
      if (reviews.length < 100) review = reviewState(reviews);
    } catch {
      /* Preserve the PR when additional provider reads are unavailable. */
    }
    try {
      const result = await provider(
        `/repos/${v.repository}/commits/${encodeURIComponent(p.head.sha)}/check-runs?per_page=100&filter=latest`,
        token,
      );
      if (result.total_count <= 100) checks = checkState(result.check_runs);
    } catch {
      /* Existing installations may not yet grant Checks read. */
    }
    pullRequests.push({
      number,
      title: String(p.title),
      url: `https://github.com/${v.repository}/pull/${number}`,
      state: p.merged_at
        ? "merged"
        : p.state === "closed"
          ? "closed"
          : p.draft
            ? "draft"
            : "open",
      headSha: p.head.sha,
      review,
      checks,
    });
  }
  // Recheck audience and binding after remote reads, including concurrent unlink.
  await tx(async (c) => {
    await access(c, actor, v.list_id);
    const current = await context(c, taskId);
    const {
      rows: [still],
    } = await c.query(
      "select issue_number from wuff_github_links where task_id=$1",
      [taskId],
    );
    if (
      current.repository_id !== v.repository_id ||
      still?.issue_number !== link.issueNumber
    )
      fail(
        "conflict",
        "The GitHub link changed. Reload before reading pull requests.",
      );
    await c.query(
      `insert into wuff_github_pr_snapshots(task_id,repository_id,issue_number,pull_requests,stale)
      values($1,$2,$3,$4,$5) on conflict(task_id) do update set repository_id=excluded.repository_id,
      issue_number=excluded.issue_number,pull_requests=excluded.pull_requests,stale=excluded.stale,fetched_at=now()`,
      [
        taskId,
        v.repository_id,
        link.issueNumber,
        JSON.stringify(pullRequests),
        truncated || current.list_version !== v.list_version,
      ],
    );
  });
  return { pullRequests, truncated, fetchedAt: new Date().toISOString() };
}
