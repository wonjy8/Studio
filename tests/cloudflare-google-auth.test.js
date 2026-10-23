import { test } from "node:test";
import assert from "node:assert/strict";
import { googleEdgeFixture } from "./helpers/google-edge-fixture.js";
import { randomToken, unseal } from "../cloudflare/google-crypto.js";
import { requiredScopes, sha256 } from "../cloudflare/authority.js";
test("Google subject login binds state/PKCE/nonce, encrypts tokens, creates no administrator and blocks replay", async (t) => {
  const f = await googleEdgeFixture(t),
    flow = await f.begin();
  assert.equal(flow.response.status, 200);
  assert.equal(flow.params.get("code_challenge_method"), "S256");
  assert.equal(
    flow.params.get("redirect_uri"),
    f.env.APP_ORIGIN + "/oauth/google/callback",
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_accounts").get().n,
    0,
  );
  const response = await f.finish(flow);
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.equal(result.setup.ready, true);
  const status = await f.session();
  assert.deepEqual(status.roles, []);
  assert.equal(status.setup.ready, true);
  const row = f.db.sqlite.prepare("SELECT * FROM cf_google_tokens").get();
  assert.ok(!row.sealed.includes("fixture-only-refresh-marker"));
  assert.equal(
    (
      await unseal(
        f.env,
        row.sealed,
        f.accountId + "\0" + row.generation + "\0google",
      )
    ).refreshToken,
    "fixture-only-refresh-marker",
  );
  await assert.rejects(
    unseal(f.env, row.sealed, "other\0" + row.generation + "\0google"),
  );
  assert.equal((await f.finish(flow)).status, 401);
  assert.equal(
    f.calls.filter((c) => c.url === "https://oauth2.googleapis.com/token")
      .length,
    1,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT payload FROM cf_auth_attempts").get().payload,
    null,
  );
  assert.ok(!JSON.stringify(result).includes("access_token"));
});
test("unknown Google identity requires explicit signup or legacy proof and never auto-merges matching email", async (t) => {
  const f = await googleEdgeFixture(t);
  f.db.sqlite
    .prepare("INSERT INTO cf_accounts VALUES(?,?,?,?)")
    .run("legacy", "active", "same@example.invalid", 1);
  const flow = await f.begin({ confirmCreateAccount: false });
  const response = await f.finish(flow);
  assert.equal(response.status, 409);
  assert.equal(
    (await response.json()).error,
    "ACCOUNT_LINK_OR_SIGNUP_REQUIRED",
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_google_identities").get().n,
    0,
  );
  assert.equal(
    (
      await f.begin({
        mode: "link",
        linkTicket: randomToken(),
        confirmLink: true,
      })
    ).response.status,
    403,
  );
});
test("one-use verified legacy ticket preserves stable account and administrator roles", async (t) => {
  const f = await googleEdgeFixture(t),
    ticket = randomToken();
  f.db.sqlite
    .prepare("INSERT INTO cf_accounts VALUES(?,?,?,?)")
    .run("legacy", "active", "Legacy", 1);
  f.db.sqlite
    .prepare("INSERT INTO cf_role_bindings VALUES(?,?,?)")
    .run("legacy", "highest_administrator", "reviewed_legacy_mapping");
  f.db.sqlite
    .prepare("INSERT INTO cf_legacy_link_tickets VALUES(?,?,?,?,NULL)")
    .run(
      await sha256(ticket),
      "legacy",
      "verified_legacy_session",
      Date.now() + 60000,
    );
  const flow = await f.begin({
      mode: "link",
      linkTicket: ticket,
      confirmLink: true,
      confirmCreateAccount: false,
    }),
    response = await f.finish(flow);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(f.accountId, "legacy");
  assert.deepEqual((await f.session()).roles, ["highest_administrator"]);
  assert.ok(
    f.db.sqlite.prepare("SELECT consumed_at FROM cf_legacy_link_tickets").get()
      .consumed_at,
  );
  assert.equal(
    (await f.begin({ mode: "link", linkTicket: ticket, confirmLink: true }))
      .response.status,
    403,
  );
});
test("partial/denied scopes, missing offline consent, readonly calendars and disabled services do not unlock the app", async (t) => {
  for (const kind of ["scope", "offline", "readonly", "api"]) {
    const f = await googleEdgeFixture(t);
    if (kind === "scope")
      f.flags.scopes = requiredScopes.filter(
        (s) => !s.includes("calendar.events"),
      );
    if (kind === "offline") f.flags.refresh = null;
    if (kind === "readonly") f.flags.readonlyCalendar = true;
    if (kind === "api") f.flags.driveDenied = true;
    const response = await f.finish(await f.begin());
    assert.equal(response.status, 200, kind);
    assert.equal((await response.json()).setup.ready, false);
    assert.equal((await f.session()).setup.ready, false);
    assert.equal((await f.call("/api/edge/documents")).status, 403);
  }
});
test("callback verifies signature, issuer, audience, nonce, lifetime and access-token subject before linking", async (t) => {
  for (const mutation of [
    { claims: { iss: "https://attacker.example" } },
    { claims: { aud: "other-client" } },
    { claims: { nonce: "wrong" } },
    { claims: { exp: 1 } },
    { header: { alg: "none" } },
    { badSignature: true },
    { accessSubject: "other-subject" },
  ]) {
    const f = await googleEdgeFixture(t);
    Object.assign(f.flags, mutation);
    const response = await f.finish(await f.begin());
    assert.equal(response.status, 401, JSON.stringify(mutation));
    assert.equal(
      f.db.sqlite.prepare("SELECT count(*) n FROM cf_accounts").get().n,
      0,
    );
  }
});
test("OAuth denial, wrong browser state, account switch and expired state never establish a session", async (t) => {
  const f = await googleEdgeFixture(t),
    denied = await f.begin();
  const response = await f.call(
    "/oauth/google/callback?" +
      new URLSearchParams({ state: denied.state, error: "access_denied" }),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "GOOGLE_CONSENT_DENIED");
  const flow = await f.begin();
  const browser = f.jar.get("__Host-studio_oauth");
  f.jar.set("__Host-studio_oauth", randomToken());
  assert.equal((await f.finish(flow)).status, 401);
  f.jar.set("__Host-studio_oauth", browser);
  f.jar.set("__Host-studio_session", randomToken());
  assert.equal((await f.finish(flow)).status, 401);
  f.jar.delete("__Host-studio_session");
  const expired = await f.begin();
  f.db.sqlite
    .prepare("UPDATE cf_auth_attempts SET expires_at=1 WHERE state_hash=?")
    .run(await sha256(expired.state));
  assert.equal((await f.finish(expired)).status, 401);
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_accounts").get().n,
    0,
  );
});
test("reconnect rejects another Google subject, rotates generation on success and blocks stale sessions", async (t) => {
  const f = await googleEdgeFixture(t);
  assert.equal((await f.finish(await f.begin())).status, 200);
  const old = new Map(f.jar),
    generation = f.db.sqlite
      .prepare("SELECT generation FROM cf_connections")
      .get().generation;
  f.flags.subject = "other-subject";
  assert.equal(
    (await f.finish(await f.begin({ mode: "reconnect" }))).status,
    409,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT generation FROM cf_connections").get()
      .generation,
    generation,
  );
  f.flags.subject = "google-subject-a";
  assert.equal(
    (await f.finish(await f.begin({ mode: "reconnect" }))).status,
    200,
  );
  assert.notEqual(
    f.db.sqlite.prepare("SELECT generation FROM cf_connections").get()
      .generation,
    generation,
  );
  assert.equal(
    (await f.call("/api/edge/session", { cookies: old })).status,
    401,
  );
});
test("refresh invalid_grant and local disconnect scrub credentials, preserve content and distinguish provider permissions", async (t) => {
  const f = await googleEdgeFixture(t);
  assert.equal((await f.finish(await f.begin())).status, 200);
  f.db.sqlite.prepare("UPDATE cf_google_tokens SET access_expires_at=1").run();
  f.flags.refreshRevoked = true;
  assert.equal((await f.protectedPost("/api/edge/auth/verify")).status, 401);
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_google_tokens").get().n,
    0,
  );
  assert.equal((await f.call("/api/edge/session")).status, 401);
  f.flags.refreshRevoked = false;
  assert.equal((await f.finish(await f.begin())).status, 200);
  const disconnected = await f.protectedPost("/api/edge/auth/disconnect");
  assert.equal(disconnected.status, 200);
  assert.equal((await disconnected.json()).providerGrantRevoked, false);
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_accounts").get().n,
    1,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_google_tokens").get().n,
    0,
  );
  assert.ok(!f.calls.some((c) => c.url.includes("/revoke")));
});
test("start requires CSRF, configured secrets and durable rate budget", async (t) => {
  const f = await googleEdgeFixture(t);
  assert.equal(
    (await f.call("/api/edge/auth/google/start", { method: "POST", data: {} }))
      .status,
    403,
  );
  for (let i = 0; i < 20; i++)
    assert.equal((await f.begin()).response.status, 200);
  assert.equal((await f.begin()).response.status, 429);
  f.env.GOOGLE_TOKEN_KEY = "bad";
  assert.equal(
    (await (await f.call("/api/edge/auth/bootstrap")).json()).configured,
    false,
  );
});
test("legacy proof consumed during provider roundtrip cannot link or change administrator state", async (t) => {
  const f = await googleEdgeFixture(t),
    ticket = randomToken();
  f.db.sqlite
    .prepare("INSERT INTO cf_accounts VALUES(?,?,?,?)")
    .run("legacy", "active", "Legacy", 1);
  f.db.sqlite
    .prepare("INSERT INTO cf_role_bindings VALUES(?,?,?)")
    .run("legacy", "administrator", "reviewed_legacy_mapping");
  f.db.sqlite
    .prepare("INSERT INTO cf_legacy_link_tickets VALUES(?,?,?,?,NULL)")
    .run(
      await sha256(ticket),
      "legacy",
      "operator_reviewed",
      Date.now() + 60000,
    );
  const flow = await f.begin({
    mode: "link",
    linkTicket: ticket,
    confirmLink: true,
  });
  f.flags.beforeDrive = () =>
    f.db.sqlite
      .prepare("UPDATE cf_legacy_link_tickets SET consumed_at=1")
      .run();
  const response = await f.finish(flow);
  assert.equal(response.status, 409);
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_google_identities").get().n,
    0,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_sessions").get().n,
    0,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT role FROM cf_role_bindings").get().role,
    "administrator",
  );
});
test("account disabled during provider checks is not recreated or authenticated", async (t) => {
  const f = await googleEdgeFixture(t),
    flow = await f.begin();
  f.flags.beforeDrive = async () => {
    const id =
      "google-" +
      (await sha256("https://accounts.google.com\0" + f.flags.subject)).slice(
        0,
        40,
      );
    f.db.sqlite
      .prepare("INSERT INTO cf_accounts VALUES(?,?,?,?)")
      .run(id, "disabled", "Disabled fixture", 1);
  };
  const response = await f.finish(flow);
  assert.equal(response.status, 409);
  assert.equal(
    f.db.sqlite.prepare("SELECT status FROM cf_accounts").get().status,
    "disabled",
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_google_identities").get().n,
    0,
  );
});
test("readiness retry after API recovery unlocks only the same verified subject", async (t) => {
  const f = await googleEdgeFixture(t);
  f.flags.driveDenied = true;
  assert.equal((await f.finish(await f.begin())).status, 200);
  assert.equal((await f.session()).setup.ready, false);
  f.flags.driveDenied = false;
  assert.equal((await f.protectedPost("/api/edge/auth/verify")).status, 200);
  assert.equal((await f.session()).setup.ready, true);
});
test("concurrent refreshes use a durable lease and reconnect discards the older provider result", async (t) => {
  const f = await googleEdgeFixture(t);
  assert.equal((await f.finish(await f.begin())).status, 200);
  f.db.sqlite.prepare("UPDATE cf_google_tokens SET access_expires_at=1").run();
  let entered, release;
  const enteredPromise = new Promise((r) => (entered = r)),
    blocked = new Promise((r) => (release = r));
  f.flags.beforeRefresh = async () => {
    entered();
    await blocked;
  };
  const first = f.protectedPost("/api/edge/auth/verify");
  await enteredPromise;
  assert.equal((await f.protectedPost("/api/edge/auth/verify")).status, 409);
  const old = f.db.sqlite
    .prepare("SELECT sealed FROM cf_google_tokens")
    .get().sealed;
  f.db.sqlite
    .prepare("UPDATE cf_connections SET generation='new-connection'")
    .run();
  f.db.sqlite
    .prepare(
      "UPDATE cf_google_tokens SET generation='new-connection',lease=NULL,lease_until=NULL",
    )
    .run();
  release();
  assert.equal((await first).status, 401);
  const current = f.db.sqlite
    .prepare("SELECT generation,sealed FROM cf_google_tokens")
    .get();
  assert.equal(current.generation, "new-connection");
  assert.equal(current.sealed, old);
});
test("local disconnect authority change rolls back atomically", async (t) => {
  const f = await googleEdgeFixture(t);
  assert.equal((await f.finish(await f.begin())).status, 200);
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    f.db.sqlite.prepare("UPDATE cf_sessions SET revoked_at=1").run();
  };
  assert.equal(
    (await f.protectedPost("/api/edge/auth/disconnect")).status,
    409,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT count(*) n FROM cf_google_tokens").get().n,
    1,
  );
  assert.equal(
    f.db.sqlite.prepare("SELECT revoked_at FROM cf_connections").get()
      .revoked_at,
    null,
  );
});
test("OAuth client change rotates connection context and preserves existing account roles", async (t) => {
  const f = await googleEdgeFixture(t);
  assert.equal((await f.finish(await f.begin())).status, 200);
  const old = new Map(f.jar),
    id = f.accountId,
    generation = f.db.sqlite
      .prepare("SELECT generation FROM cf_connections")
      .get().generation;
  f.db.sqlite
    .prepare("INSERT INTO cf_role_bindings VALUES(?,?,?)")
    .run(id, "administrator", "explicit_appointment");
  f.env.GOOGLE_CLIENT_ID = "fixture-new-web-client";
  assert.equal(
    (await f.finish(await f.begin({ confirmAccountSwitch: true }))).status,
    200,
  );
  assert.equal(f.accountId, id);
  assert.notEqual(
    f.db.sqlite.prepare("SELECT generation FROM cf_connections").get()
      .generation,
    generation,
  );
  assert.equal(
    (await f.call("/api/edge/session", { cookies: old })).status,
    401,
  );
  assert.deepEqual((await f.session()).roles, ["administrator"]);
});
test("provider redirects are rejected without following or forwarding credentials", async () => {
  const { googleProvider } = await import("../cloudflare/google-provider.js");
  let calls = 0;
  const provider = googleProvider(async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { Location: "https://attacker.example" },
    });
  });
  await assert.rejects(
    provider.json("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { Authorization: "Bearer fixture-only" },
    }),
    (e) => e.code === "GOOGLE_REDIRECT_REJECTED",
  );
  assert.equal(calls, 1);
});
