import { test } from "node:test";
import assert from "node:assert/strict";
import { googleEdgeFixture } from "./helpers/google-edge-fixture.js";
test("onboarding assets are self-hosted with bounded CSP and no secrets", async (t) => {
  const f = await googleEdgeFixture(t);
  for (const path of [
    "/",
    "/login",
    "/setup",
    "/auth/complete",
    "/edge-ui.js",
    "/edge-ui.css",
  ]) {
    const r = await f.worker.fetch(new Request(f.env.APP_ORIGIN + path), f.env);
    assert.equal(r.status, 200);
    assert.match(
      r.headers.get("Content-Security-Policy"),
      /default-src 'none'/,
    );
    assert.equal(r.headers.get("Cache-Control"), "no-store");
    const body = await r.text();
    assert.ok(!body.includes(f.env.GOOGLE_CLIENT_SECRET));
    assert.ok(!body.includes(f.env.GOOGLE_TOKEN_KEY));
  }
});
test("HTML callback handoff retains secure session without credentials in redirect", async (t) => {
  const f = await googleEdgeFixture(t),
    flow = await f.begin();
  const r = await f.call(
    "/oauth/google/callback?" +
      new URLSearchParams({ state: flow.state, code: flow.code }),
    { headers: { Accept: "text/html" } },
  );
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("Location"), "/auth/complete");
  assert.match(r.headers.get("Set-Cookie"), /__Host-studio_session=/);
  assert.equal((await f.session()).setup.ready, true);
});
