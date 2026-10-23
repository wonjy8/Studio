import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/worker.js";
import { requiredScopes, sha256 } from "../cloudflare/authority.js";
import { localD1 } from "./helpers/d1-local.js";
const origin = "https://edge.example.invalid",
  tokens = { a: "a".repeat(48), b: "b".repeat(48) };
async function fixture(t) {
  const db = localD1();
  t.after(() => db.sqlite.close());
  for (const id of ["a", "b"]) {
    db.sqlite
      .prepare("INSERT INTO cf_accounts VALUES(?,?,?,?)")
      .run(id, "active", id, Date.now());
    db.sqlite
      .prepare("INSERT INTO cf_connections VALUES(?,?,?,?,?,NULL)")
      .run(
        id,
        "generation-" + id,
        "verified",
        "verified",
        JSON.stringify(requiredScopes),
      );
    db.sqlite
      .prepare("INSERT INTO cf_sessions VALUES(?,?,?,?,NULL)")
      .run(
        await sha256(tokens[id]),
        id,
        "generation-" + id,
        Date.now() + 60000,
      );
  }
  const env = { APP_ORIGIN: origin, DB: db };
  const call = async (
    path,
    { user = "a", method = "GET", data, headers = {} } = {},
  ) =>
    worker.fetch(
      new Request(origin + path, {
        method,
        headers: {
          Cookie: "__Host-studio_session=" + tokens[user],
          Origin: origin,
          "Content-Type": "application/json",
          "X-Studio-Account": user,
          "X-Studio-CSRF": await sha256("csrf\0" + tokens[user]),
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
  return { db, env, call };
}
const documents = (text) => [
  {
    id: "document",
    title: "Own document",
    blocks: [{ id: "block", type: "paragraph", content: [{ text }] }],
  },
];
test("Workers foundation exposes truthful readiness and denies unported routes without fake success", async (t) => {
  const { call } = await fixture(t);
  assert.equal(
    (await (await call("/health")).json()).readiness,
    "foundation-only",
  );
  assert.equal((await call("/api/workspace")).status, 501);
  assert.equal(
    (await call("/api/edge/documents", { headers: { Cookie: "" } })).status,
    401,
  );
  const status = await (await call("/api/edge/session")).json();
  assert.equal(status.setup.ready, true);
  assert.deepEqual(status.roles, []);
  assert.ok(status.csrfToken);
  assert.equal((await (await call("/api/edge/documents")).json()).revision, 0);
});
test("D1 own document roundtrip, CAS conflict, identical retry and tenant/CSRF/account boundaries", async (t) => {
  const { call, db } = await fixture(t),
    first = { documents: documents("Private A"), revision: 0 };
  const saved = await (
    await call("/api/edge/documents", { method: "PUT", data: first })
  ).json();
  assert.equal(saved.revision, 1);
  assert.deepEqual(
    (await (await call("/api/edge/documents")).json()).documents,
    first.documents,
  );
  assert.deepEqual(
    (await (await call("/api/edge/documents", { user: "b" })).json()).documents,
    [],
  );
  assert.equal(
    (
      await call("/api/edge/documents", {
        headers: { "X-Studio-Account": "b" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/edge/documents", {
        method: "PUT",
        data: { documents: documents("stale"), revision: 0 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await (
        await call("/api/edge/documents", { method: "PUT", data: first })
      ).json()
    ).revision,
    1,
  );
  for (const [header, value, status] of [
    ["Origin", "https://attacker.example", 403],
    ["X-Studio-CSRF", "wrong", 403],
    ["X-Studio-Account", "b", 409],
  ])
    assert.equal(
      (
        await call("/api/edge/documents", {
          method: "PUT",
          data: first,
          headers: { [header]: value },
        })
      ).status,
      status,
    );
  assert.equal(
    (
      await call("/api/edge/documents", {
        method: "PUT",
        data: { ...first, accountId: "b" },
      })
    ).status,
    400,
  );
  assert.equal(
    db.sqlite.prepare("SELECT count(*) n FROM cf_write_fences").get().n,
    0,
  );
  assert.equal(
    db.sqlite.prepare("SELECT count(*) n FROM cf_resource_chunks").get().n,
    1,
  );
});
test("D1 chunks valid multi-megabyte structured JSON below row limits with exact UTF-8 and keeps only current generation", async (t) => {
  const { call, db } = await fixture(t),
    runs = Array.from({ length: 2000 }, () => ({
      text: "한",
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      code: true,
      color: "#2563eb",
      background: "#dbeafe",
      href: "https://example.invalid/reference",
    })),
    large = [
      {
        id: "large",
        title: "Large JSON",
        blocks: Array.from({ length: 10 }, (_, i) => ({
          id: "block-" + i,
          type: "paragraph",
          content: runs,
        })),
      },
    ];
  assert.ok(new TextEncoder().encode(JSON.stringify(large)).length > 2000000);
  const response = await call("/api/edge/documents", {
    method: "PUT",
    data: { documents: large, revision: 0 },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await (await call("/api/edge/documents")).json()).documents,
    large,
  );
  const sizes = db.sqlite
    .prepare("SELECT length(bytes) size FROM cf_resource_chunks")
    .all();
  assert.ok(sizes.length > 1 && sizes.every((row) => row.size <= 512000));
  assert.equal(
    (
      await call("/api/edge/documents", {
        method: "PUT",
        data: { documents: documents("Replacement"), revision: 1 },
      })
    ).status,
    200,
  );
  assert.equal(
    db.sqlite.prepare("SELECT count(*) n FROM cf_resource_chunks").get().n,
    1,
  );
});
test("atomic batch authority fence rolls back after revocation between read and write, without staged orphans", async (t) => {
  const { call, db } = await fixture(t);
  db.beforeBatch = () => {
    db.beforeBatch = null;
    db.sqlite
      .prepare("UPDATE cf_sessions SET revoked_at=1 WHERE account_id=?")
      .run("a");
  };
  assert.equal(
    (
      await call("/api/edge/documents", {
        method: "PUT",
        data: { documents: documents("must not save"), revision: 0 },
      })
    ).status,
    401,
  );
  for (const table of [
    "cf_resource_heads",
    "cf_resource_chunks",
    "cf_write_fences",
  ])
    assert.equal(
      db.sqlite.prepare("SELECT count(*) n FROM " + table).get().n,
      0,
    );
});
test("mandatory Drive/Calendar, scope revocation, generation changes and preserved administrator bindings", async (t) => {
  const { call, db } = await fixture(t);
  db.sqlite
    .prepare("INSERT INTO cf_role_bindings VALUES(?,?,?)")
    .run("a", "highest_administrator", "reviewed_legacy_mapping");
  assert.deepEqual((await (await call("/api/edge/session")).json()).roles, [
    "highest_administrator",
  ]);
  db.sqlite
    .prepare(
      "UPDATE cf_connections SET drive_status='partial' WHERE account_id='a'",
    )
    .run();
  assert.equal(
    (await (await call("/api/edge/session")).json()).setup.ready,
    false,
  );
  assert.equal((await call("/api/edge/documents")).status, 403);
  db.sqlite
    .prepare(
      "UPDATE cf_connections SET drive_status='verified',scopes_json='[]' WHERE account_id='a'",
    )
    .run();
  assert.equal((await call("/api/edge/documents")).status, 403);
  db.sqlite
    .prepare(
      "UPDATE cf_connections SET generation='new-generation' WHERE account_id='a'",
    )
    .run();
  assert.equal((await call("/api/edge/session")).status, 401);
  assert.deepEqual(
    (await (await call("/api/edge/session", { user: "b" })).json()).roles,
    [],
  );
});
test("corrupt chunks fail explicitly and storage errors do not leak SQL or produce empty success", async (t) => {
  const { call, db } = await fixture(t);
  await call("/api/edge/documents", {
    method: "PUT",
    data: { documents: documents("valid"), revision: 0 },
  });
  db.sqlite.prepare("UPDATE cf_resource_chunks SET bytes=X'7b7d'").run();
  const response = await call("/api/edge/documents");
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "CORRUPT_RESOURCE");
  const broken = await worker.fetch(
    new Request(origin + "/api/edge/session", {
      headers: { Cookie: "__Host-studio_session=" + tokens.a },
    }),
    {
      APP_ORIGIN: origin,
      DB: {
        prepare() {
          throw Error("private SQL or credentials");
        },
      },
    },
  );
  assert.equal(broken.status, 503);
  assert.ok(!(await broken.text()).includes("private"));
});

test("write fence uses database-time expiry even when a valid request waits before batch execution", async (t) => {
  const { call, db } = await fixture(t);
  db.beforeBatch = async () => {
    db.beforeBatch = null;
    db.sqlite
      .prepare("UPDATE cf_sessions SET expires_at=? WHERE account_id=?")
      .run(Date.now() + 10, "a");
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  assert.equal(
    (
      await call("/api/edge/documents", {
        method: "PUT",
        data: { documents: documents("expired in queue"), revision: 0 },
      })
    ).status,
    401,
  );
  assert.equal(
    db.sqlite.prepare("SELECT count(*) n FROM cf_resource_heads").get().n,
    0,
  );
});
test("malformed UTF-8/JSON, oversized streaming requests and misleading content types fail without writes", async (t) => {
  const { env } = await fixture(t),
    headers = {
      Cookie: "__Host-studio_session=" + tokens.a,
      Origin: origin,
      "Content-Type": "application/json",
      "X-Studio-Account": "a",
      "X-Studio-CSRF": await sha256("csrf\0" + tokens.a),
    };
  for (const [body, contentType, status] of [
    ["{", "application/json", 400],
    [new Uint8Array([255]), "application/json", 400],
    ["{}", "application/jsonp", 415],
    ["x".repeat(8 * 1024 * 1024 + 1), "application/json", 413],
  ]) {
    const response = await worker.fetch(
      new Request(origin + "/api/edge/documents", {
        method: "PUT",
        headers: { ...headers, "Content-Type": contentType },
        body,
      }),
      env,
    );
    assert.equal(response.status, status);
  }
  assert.equal(
    env.DB.sqlite.prepare("SELECT count(*) n FROM cf_resource_heads").get().n,
    0,
  );
});
