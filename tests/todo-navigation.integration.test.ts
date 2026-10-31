import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes, sidebarGroups } from "@wuff/contracts";
import {
  createList,
  getList,
  deleteList,
  getListOrder,
  reorderLists,
  removeListMember,
} from "@wuff/domain";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.WUFF_ORIGIN !== origin
)
  throw Error("Isolated loopback development only");
const [user, other] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  outsider = { id: other.id, scopes },
  op = () => crypto.randomUUID();
after(() => database().pool.end());
test("Todo navigation adapters retain favorite hierarchy, show authorized context and reject revoked connections", async () => {
  const original = await getListOrder(actor),
    cookie = await loginFixture(user);
  const headers = {
    Cookie: cookie,
    Origin: origin,
    "Content-Type": "application/json",
  };
  const parent = await createList(actor, {
    title: "UX adapter parent",
    operationId: op(),
  });
  const child = await createList(actor, {
    title: "UX adapter child",
    operationId: op(),
  });
  const privateList = await createList(outsider, {
    title: "UX adapter private",
    operationId: op(),
  });
  const grants: Awaited<ReturnType<typeof empireGrant>>[] = [];
  try {
    const grant = await empireGrant(
      cookie,
      "lists:read lists:manage tasks:write",
    );
    grants.push(grant);
    const order = await getListOrder(actor);
    let response = await fetch(origin + "/api/v1/list-order", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...order,
        nesting: [
          ...(order.nesting ?? []),
          { listId: child.id, parentListId: parent.id },
        ],
        favoriteListIds: [parent.id],
        operationId: op(),
      }),
    });
    assert.equal(response.status, 200);
    let result = await empireMcp(grant.access_token, "list_lists");
    let group = sidebarGroups(
      result.result.structuredContent.lists,
      false,
    ).find((g) => g.list.id === parent.id)!;
    assert.equal(group.list.favorite, true);
    assert.deepEqual(
      group.children.map((list) => list.id),
      [child.id],
    );
    result = await empireMcp(grant.access_token, "reorder_lists", {
      ...(await getListOrder(actor)),
      favoriteListIds: [parent.id, child.id],
      operationId: op(),
    });
    assert(!result.result.isError);
    response = await fetch(origin + "/api/v1/lists", { headers });
    const web = await response.json();
    assert(web.find((list: any) => list.id === parent.id).favorite);
    assert(web.find((list: any) => list.id === child.id).favorite);
    assert.equal(
      web.find((list: any) => list.id === child.id).parentListId,
      parent.id,
    );
    for (const [tool, args] of [
      ["show_list", { listId: child.id }],
      ["get_list", { listId: child.id }],
      ["show_dashboard", { today: "2026-10-31" }],
      ["get_dashboard", { today: "2026-10-31" }],
    ] as const) {
      const current = await empireMcp(grant.access_token, tool, args);
      assert(!current.result.isError, tool);
      assert(
        current.result.structuredContent.lists.some(
          (list: any) => list.id === parent.id,
        ),
      );
      assert(
        !current.result.structuredContent.lists.some(
          (list: any) => list.id === privateList.id,
        ),
      );
    }
    const mutation = await empireMcp(grant.access_token, "create_task", {
      listId: child.id,
      version: (await getList(actor, child.id)).version,
      title: "Navigation survives mutation",
      operationId: op(),
    });
    assert(!mutation.result.isError);
    assert(
      mutation.result.structuredContent.lists.some(
        (list: any) => list.id === parent.id,
      ),
    );
    assert(
      !mutation.result.structuredContent.lists.some(
        (list: any) => list.id === privateList.id,
      ),
    );
    const readOnly = await empireGrant(cookie, "lists:read");
    grants.push(readOnly);
    result = await empireMcp(readOnly.access_token, "show_list", {
      listId: child.id,
    });
    assert(!result.result.isError);
    result = await empireMcp(readOnly.access_token, "reorder_lists", {
      ...(await getListOrder(actor)),
      favoriteListIds: [],
      operationId: op(),
    });
    assert(result.result?.isError || result.error);
    // A child shared without its parent never reveals the parent's personal title/link.
    await database()
      .db.insert(members)
      .values({ listId: child.id, userId: outsider.id });
    const otherCookie = await loginFixture(other),
      otherGrant = await empireGrant(otherCookie, "lists:read");
    try {
      result = await empireMcp(otherGrant.access_token, "show_list", {
        listId: child.id,
      });
      assert(!result.result.isError);
      assert(
        !result.result.structuredContent.lists.some(
          (list: any) => list.id === parent.id,
        ),
      );
      assert.equal(
        result.result.structuredContent.lists.find(
          (list: any) => list.id === child.id,
        ).parentListId,
        null,
      );
      await removeListMember(actor, {
        listId: child.id,
        version: (await getList(actor, child.id)).version,
        userId: outsider.id,
        operationId: op(),
      });
      result = await empireMcp(otherGrant.access_token, "show_list", {
        listId: child.id,
      });
      assert(result.result.isError);
    } finally {
      await fetch(origin + "/api/v1/connections", {
        method: "DELETE",
        headers: {
          Cookie: otherCookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: otherGrant.clientId }),
      });
    }
    await fetch(origin + "/api/v1/connections", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ clientId: grant.clientId }),
    });
    result = await empireMcp(grant.access_token, "show_list", {
      listId: child.id,
    });
    assert.equal(result.status, 401);
  } finally {
    for (const grant of grants)
      await fetch(origin + "/api/v1/connections", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ clientId: grant.clientId }),
      });
    for (const [who, list] of [
      [actor, child],
      [actor, parent],
      [outsider, privateList],
    ] as const)
      await deleteList(who, {
        listId: list.id,
        version: (await getList(who, list.id)).version,
        operationId: op(),
      });
    await reorderLists(actor, {
      ...original,
      version: (await getListOrder(actor)).version,
      operationId: op(),
    });
  }
});
