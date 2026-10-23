// Local workerd + D1 only. No Cloudflare account, remote DB, credentials or Google calls.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requiredScopes, sha256 } from "../cloudflare/authority.js";
const { Miniflare } = await import(
  process.env.STUDIO_MINIFLARE_MODULE || "miniflare"
);
const mf = new Miniflare({
  modules: true,
  modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
  modulesRoot: new URL("../", import.meta.url).pathname,
  scriptPath: new URL("../cloudflare/worker.js", import.meta.url).pathname,
  compatibilityDate: "2026-08-06",
  d1Databases: ["DB"],
  bindings: { APP_ORIGIN: "https://edge.example.invalid" },
  outboundService: () => {
    throw Error("External network is forbidden in this fixture");
  },
});
try {
  const db = await mf.getD1Database("DB"),
    schema = await readFile(
      new URL("../cloudflare/migrations/0001_foundation.sql", import.meta.url),
      "utf8",
    );
  for (const sql of schema
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean))
    await db.prepare(sql).run();
  const token = "fixture-local-workerd-session-".padEnd(48, "x"),
    hash = await sha256(token);
  await db
    .prepare("INSERT INTO cf_accounts VALUES(?,?,?,?)")
    .bind("fixture-owner", "active", "Fixture", Date.now())
    .run();
  await db
    .prepare("INSERT INTO cf_connections VALUES(?,?,?,?,?,NULL)")
    .bind(
      "fixture-owner",
      "generation-1",
      "verified",
      "verified",
      JSON.stringify(requiredScopes),
    )
    .run();
  await db
    .prepare("INSERT INTO cf_sessions VALUES(?,?,?,?,NULL)")
    .bind(hash, "fixture-owner", "generation-1", Date.now() + 600000)
    .run();
  const request = async (method = "GET", data) =>
    mf.dispatchFetch("https://edge.example.invalid/api/edge/documents", {
      method,
      headers: {
        Cookie: "__Host-studio_session=" + token,
        Origin: "https://edge.example.invalid",
        "Content-Type": "application/json",
        "X-Studio-Account": "fixture-owner",
        "X-Studio-CSRF": await sha256("csrf\0" + token),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  const document = (text) => [
    {
      id: "doc",
      title: "Local D1",
      blocks: [{ id: "p", type: "paragraph", content: [{ text }] }],
    },
  ];
  assert.equal((await request()).status, 200);
  assert.equal(
    (await request("PUT", { documents: document("Original"), revision: 0 }))
      .status,
    200,
  );
  assert.equal(
    (await request("PUT", { documents: document("Stale"), revision: 0 }))
      .status,
    409,
  );
  assert.equal(
    (await request("PUT", { documents: document("Original"), revision: 0 }))
      .status,
    200,
  );
  const runs = Array.from({ length: 2000 }, () => ({
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
        title: "D1 chunks over 2MB",
        blocks: Array.from({ length: 10 }, (_, i) => ({
          id: "p-" + i,
          type: "paragraph",
          content: runs,
        })),
      },
    ];
  assert.ok(new TextEncoder().encode(JSON.stringify(large)).length > 2000000);
  const saved = await request("PUT", { documents: large, revision: 1 });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.deepEqual((await (await request()).json()).documents, large);
  const chunks = await db
    .prepare(
      "SELECT max(length(bytes)) size,count(*) n FROM cf_resource_chunks",
    )
    .first();
  assert.ok(chunks.n > 1 && chunks.size <= 512000);
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM cf_write_fences").first()).n,
    0,
  );
  const races = await Promise.all(
    ["Left", "Right"].map((text) =>
      request("PUT", { documents: document(text), revision: 2 }),
    ),
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await (await request()).json()).revision, 3);
  const interleaved = await Promise.all([
    request(),
    request("PUT", { documents: large, revision: 3 }),
    request(),
  ]);
  assert.ok(interleaved.every((r) => r.status === 200));
  for (const index of [0, 2]) {
    const value = await interleaved[index].json();
    assert.ok(value.revision === 3 || value.revision === 4);
    if (value.revision === 4) assert.deepEqual(value.documents, large);
  }
  const latest = await (await request()).json();
  assert.equal(latest.revision, 4);
  assert.deepEqual(latest.documents, large);
  const before = (
    await db.prepare("SELECT count(*) n FROM cf_resource_chunks").first()
  ).n;
  await assert.rejects(
    db.batch([
      db
        .prepare("INSERT INTO cf_resource_chunks VALUES(?,'documents',?,?,?)")
        .bind("fixture-owner", "do-not-commit", 0, new Uint8Array([1]).buffer),
      db
        .prepare("INSERT INTO cf_write_fences VALUES(?,0)")
        .bind("denied-fence"),
    ]),
  );
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM cf_resource_chunks").first()).n,
    before,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM cf_write_fences").first()).n,
    0,
  );
  await db.prepare("UPDATE cf_connections SET generation='reconnected'").run();
  assert.equal((await request()).status, 401);
  console.log(
    "PASS actual local workerd/D1 migration, session, CAS409 rollback, idempotent retry, >2MB UTF-8 chunk roundtrip, bounded chunks, no orphan fences, reconnect rejection",
  );
} finally {
  await mf.dispose();
}
