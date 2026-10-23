// Actual local workerd/D1. Google is a fixed synthetic provider, never a live account.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { googleEdgeFixture } from "../tests/helpers/google-edge-fixture.js";
import { sha256 } from "../cloudflare/authority.js";
import { unseal } from "../cloudflare/google-crypto.js";
const { Miniflare, Response: RuntimeResponse } = await import(
    process.env.STUDIO_MINIFLARE_MODULE || "miniflare"
  ),
  fixture = await googleEdgeFixture(),
  jar = new Map();
const mf = new Miniflare({
  modules: true,
  modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
  modulesRoot: new URL("../", import.meta.url).pathname,
  scriptPath: new URL("../cloudflare/worker.js", import.meta.url).pathname,
  compatibilityDate: "2026-08-06",
  d1Databases: ["DB"],
  bindings: Object.fromEntries(
    Object.entries(fixture.env).filter(([key]) => key !== "DB"),
  ),
  outboundService: async (request) => {
    const response = await fixture.fetcher(request.url, {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: request.method === "GET" ? undefined : await request.text(),
    });
    return new RuntimeResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: Object.fromEntries(response.headers),
    });
  },
});
try {
  const db = await mf.getD1Database("DB");
  for (const name of ["0001_foundation.sql", "0002_google_identity.sql"])
    for (const sql of (
      await readFile(
        new URL("../cloudflare/migrations/" + name, import.meta.url),
        "utf8",
      )
    )
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  const call = async (path, { method = "GET", data, headers = {} } = {}) => {
    const response = await mf.dispatchFetch(fixture.env.APP_ORIGIN + path, {
      method,
      headers: {
        Origin: fixture.env.APP_ORIGIN,
        "Content-Type": "application/json",
        Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"),
        index = pair.indexOf("="),
        key = pair.slice(0, index),
        value = pair.slice(index + 1);
      if (value) jar.set(key, value);
      else jar.delete(key);
    }
    return response;
  };
  const bootstrap = await (await call("/api/edge/auth/bootstrap")).json();
  assert.equal(bootstrap.configured, true);
  const start = await call("/api/edge/auth/google/start", {
    method: "POST",
    data: { mode: "signin", confirmCreateAccount: true },
    headers: { "X-Studio-CSRF": bootstrap.csrfToken },
  });
  assert.equal(start.status, 200, await start.clone().text());
  const params = new URL((await start.json()).url).searchParams,
    state = params.get("state"),
    hash = await sha256(state),
    attempt = await db
      .prepare("SELECT payload FROM cf_auth_attempts WHERE state_hash=?")
      .bind(hash)
      .first(),
    payload = await unseal(fixture.env, attempt.payload, "attempt\0" + hash),
    code = "local-code-" + state;
  fixture.codes.set(code, {
    params,
    verifierHash: await sha256(payload.verifier),
  });
  const callback =
      "/oauth/google/callback?" + new URLSearchParams({ state, code }),
    result = await call(callback);
  assert.equal(result.status, 200, await result.clone().text());
  const body = await result.json();
  assert.equal(body.setup.ready, true);
  const session = await (await call("/api/edge/session")).json();
  assert.equal(session.setup.ready, true);
  assert.deepEqual(session.roles, []);
  const row = await db.prepare("SELECT * FROM cf_google_tokens").first();
  assert.ok(!row.sealed.includes("fixture-only-refresh-marker"));
  assert.equal((await call(callback)).status, 401);
  fixture.flags.refreshRevoked = true;
  await db.prepare("UPDATE cf_google_tokens SET access_expires_at=1").run();
  assert.equal(
    (
      await call("/api/edge/auth/verify", {
        method: "POST",
        data: {},
        headers: {
          "X-Studio-CSRF": session.csrfToken,
          "X-Studio-Account": session.account.id,
        },
      })
    ).status,
    401,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM cf_google_tokens").first()).n,
    0,
  );
  assert.equal((await call("/api/edge/session")).status, 401);
  console.log(
    "PASS actual local workerd/D1 Google callback, real RSA/AES, PKCE/state/nonce, setup gate, no role inference, encrypted token persistence, replay reject and invalid_grant revocation; all provider calls mocked",
  );
} finally {
  await mf.dispose();
  fixture.db.sqlite.close();
}
