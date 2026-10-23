import { readFileSync } from "node:fs";
import { localD1 } from "./d1-local.js";
import { createWorker } from "../../cloudflare/worker.js";
import { base64url, randomToken } from "../../cloudflare/google-crypto.js";
import { requiredScopes, sha256 } from "../../cloudflare/authority.js";
let keysPromise;
export async function identityKeys() {
  keysPromise ||= crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  );
  return keysPromise;
}
export async function googleEdgeFixture(t) {
  const db = localD1();
  db.sqlite.exec(
    readFileSync(
      new URL(
        "../../cloudflare/migrations/0002_google_identity.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  t?.after(() => db.sqlite.close());
  const keys = await identityKeys(),
    jwk = {
      ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
      kid: "fixture-key",
      alg: "RS256",
      use: "sig",
    },
    env = {
      APP_ORIGIN: "https://edge.example.invalid",
      DB: db,
      GOOGLE_CLIENT_ID: "fixture-web-client",
      GOOGLE_CLIENT_SECRET: "fixture-only-client-secret",
      GOOGLE_TOKEN_KEY: base64url(new Uint8Array(32).fill(7)),
    },
    flags = {
      subject: "google-subject-a",
      scopes: [...requiredScopes],
      refresh: "fixture-only-refresh-marker",
    },
    codes = new Map(),
    calls = [],
    accessSubjects = new Map();
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const fetcher = async (url, options = {}) => {
    url = String(url);
    calls.push({ url, method: options.method || "GET" });
    if (url === "https://www.googleapis.com/oauth2/v3/certs")
      return json({ keys: [jwk] });
    if (url === "https://oauth2.googleapis.com/token") {
      const form = new URLSearchParams(options.body);
      if (
        form.get("client_id") !== env.GOOGLE_CLIENT_ID ||
        form.get("client_secret") !== env.GOOGLE_CLIENT_SECRET
      )
        return json({ error: "invalid_client" }, 401);
      if (form.get("grant_type") === "refresh_token") {
        await flags.beforeRefresh?.();
        if (flags.refreshRevoked) return json({ error: "invalid_grant" }, 400);
        const access = "fixture-refreshed-" + randomToken();
        accessSubjects.set(access, flags.subject);
        return json({
          access_token: access,
          token_type: "Bearer",
          expires_in: 3600,
          ...(flags.refreshScopes
            ? { scope: flags.refreshScopes.join(" ") }
            : {}),
        });
      }
      const context = codes.get(form.get("code"));
      if (!context) return json({ error: "invalid_grant" }, 400);
      if ((await sha256(form.get("code_verifier"))) !== context.verifierHash)
        return json({ error: "invalid_grant" }, 400);
      await flags.beforeExchange?.();
      if (flags.tokenError) return json({ error: flags.tokenError }, 400);
      const now = Math.floor(Date.now() / 1000),
        claims = {
          iss: "https://accounts.google.com",
          aud: env.GOOGLE_CLIENT_ID,
          sub: flags.subject,
          nonce: context.params.get("nonce"),
          iat: now,
          exp: now + 3600,
          name: "Fixture profile",
          email: "same@example.invalid",
          ...flags.claims,
        },
        header = base64url(
          new TextEncoder().encode(
            JSON.stringify({
              alg: "RS256",
              kid: "fixture-key",
              ...flags.header,
            }),
          ),
        ),
        payload = base64url(new TextEncoder().encode(JSON.stringify(claims))),
        signature = base64url(
          await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            keys.privateKey,
            new TextEncoder().encode(header + "." + payload),
          ),
        );
      let id = header + "." + payload + "." + signature;
      if (flags.badSignature)
        id =
          id.slice(0, header.length + payload.length + 2) +
          (signature[0] === "a" ? "b" : "a") +
          signature.slice(1);
      const access = "fixture-access-" + randomToken();
      accessSubjects.set(access, flags.accessSubject || flags.subject);
      return json({
        access_token: access,
        id_token: id,
        token_type: "Bearer",
        expires_in: 3600,
        scope: flags.scopes.join(" "),
        ...(flags.refresh ? { refresh_token: flags.refresh } : {}),
      });
    }
    const access = new Headers(options.headers || {})
        .get("Authorization")
        ?.slice(7),
      subject = accessSubjects.get(access);
    if (!subject) return json({ error: "invalid_token" }, 401);
    if (flags.apiRevoked) return json({ error: "invalid_token" }, 401);
    if (url === "https://openidconnect.googleapis.com/v1/userinfo")
      return json({ sub: subject });
    if (url.startsWith("https://www.googleapis.com/drive/v3/about")) {
      await flags.beforeDrive?.();
      return flags.driveDenied
        ? json({ error: { code: 403 } }, 403)
        : json({ user: { permissionId: "fixture-drive-owner" } });
    }
    if (
      url.startsWith(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      )
    )
      return flags.calendarUnavailable
        ? json({ error: { code: 503 } }, 503)
        : json({
            items: [
              {
                id: "fixture-primary",
                accessRole: flags.readonlyCalendar ? "reader" : "owner",
              },
            ],
          });
    throw Error("Unexpected external URL in fixture");
  };
  const worker = createWorker({ googleFetcher: fetcher }),
    jar = new Map();
  let accountId;
  const call = async (
    path,
    { method = "GET", data, headers = {}, cookies = jar } = {},
  ) => {
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + path, {
        method,
        headers: {
          Origin: env.APP_ORIGIN,
          "Content-Type": "application/json",
          Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
          ...(accountId ? { "X-Studio-Account": accountId } : {}),
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
    if (cookies === jar) {
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(";")[0],
          index = pair.indexOf("="),
          name = pair.slice(0, index),
          valuePart = pair.slice(index + 1);
        if (valuePart) jar.set(name, valuePart);
        else jar.delete(name);
      }
      if (response.ok) {
        const value = await response.clone().json();
        if (value.account?.id) accountId = value.account.id;
      }
    }
    return response;
  };
  const begin = async (data = {}, headers = {}) => {
    const bootstrap = await (await call("/api/edge/auth/bootstrap")).json(),
      response = await call("/api/edge/auth/google/start", {
        method: "POST",
        data: { mode: "signin", confirmCreateAccount: true, ...data },
        headers: { "X-Studio-CSRF": bootstrap.csrfToken, ...headers },
      }),
      body = await response.clone().json();
    if (!response.ok) return { response, body };
    const params = new URL(body.url).searchParams,
      state = params.get("state"),
      code = "fixture-code-" + state;
    const raw = db.sqlite
      .prepare("SELECT payload FROM cf_auth_attempts WHERE state_hash=?")
      .get(await sha256(state));
    const { unseal } = await import("../../cloudflare/google-crypto.js"),
      payload = await unseal(
        env,
        raw.payload,
        "attempt\0" + (await sha256(state)),
      );
    codes.set(code, { params, verifierHash: await sha256(payload.verifier) });
    return { response, body, params, state, code };
  };
  const finish = (flow) =>
    call(
      "/oauth/google/callback?" +
        new URLSearchParams({ state: flow.state, code: flow.code }),
    );
  const session = async () => await (await call("/api/edge/session")).json();
  const protectedPost = async (path) => {
    const current = await session();
    return call(path, {
      method: "POST",
      data: {},
      headers: { "X-Studio-CSRF": current.csrfToken },
    });
  };
  return {
    db,
    env,
    worker,
    flags,
    calls,
    codes,
    jar,
    call,
    begin,
    finish,
    session,
    protectedPost,
    fetcher,
    get accountId() {
      return accountId;
    },
  };
}
