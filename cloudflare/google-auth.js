import {
  authority,
  cookieToken,
  failure,
  requiredScopes,
  sha256,
} from "./authority.js";
import {
  base64url,
  randomToken,
  seal,
  unseal,
  encryptionKey,
  verifyGoogleIdentity,
} from "./google-crypto.js";
import { googleProvider } from "./google-provider.js";
import { readBoundedJson } from "./http.js";
import { googleAccessToken, revokeLocalConnection } from "./google-tokens.js";
const lifetime = 10 * 60 * 1000,
  dbNow = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
const cookie = (name, value, seconds) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function readCookie(request, name) {
  const rows = (request.headers.get("Cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(name + "="));
  if (rows.length !== 1) return null;
  const value = rows[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{40,128}$/.test(value) ? value : null;
}
function response(body, status = 200, cookies = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(JSON.stringify(body), { status, headers });
}
async function input(request) {
  const parsed = await readBoundedJson(request, 8192);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw failure("INVALID_AUTH_REQUEST");
  return parsed;
}
function configured(env) {
  return (
    typeof env.GOOGLE_CLIENT_ID === "string" &&
    env.GOOGLE_CLIENT_ID.length > 5 &&
    typeof env.GOOGLE_CLIENT_SECRET === "string" &&
    env.GOOGLE_CLIENT_SECRET.length > 5 &&
    typeof env.GOOGLE_TOKEN_KEY === "string"
  );
}
async function actorForStart(db, token) {
  if (!token) return null;
  try {
    return await authority(db, await sha256(token), Date.now(), {
      setupRequired: false,
    });
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}
export function createGoogleAuth({ fetcher = fetch } = {}) {
  const provider = googleProvider(fetcher);
  async function start(request, env) {
    if (!configured(env)) throw failure("GOOGLE_CONFIGURATION_REQUIRED", 503);
    await encryptionKey(env);
    if (request.headers.get("Origin") !== env.APP_ORIGIN)
      throw failure("CSRF_ORIGIN_REJECTED", 403);
    const login = readCookie(request, "__Host-studio_login");
    if (
      !login ||
      request.headers.get("X-Studio-CSRF") !==
        (await sha256("login-csrf\0" + login))
    )
      throw failure("CSRF_TOKEN_REJECTED", 403);
    const data = await input(request);
    if (
      Object.keys(data).some(
        (k) =>
          ![
            "mode",
            "confirmCreateAccount",
            "confirmAccountSwitch",
            "confirmLink",
            "linkTicket",
          ].includes(k),
      )
    )
      throw failure("INVALID_AUTH_REQUEST");
    const mode = data.mode || "signin";
    if (
      !["signin", "reconnect", "link"].includes(mode) ||
      ["confirmCreateAccount", "confirmAccountSwitch", "confirmLink"].some(
        (k) => data[k] !== undefined && typeof data[k] !== "boolean",
      )
    )
      throw failure("INVALID_AUTH_REQUEST");
    if (mode === "link") throw failure("LEGACY_LINK_DISABLED", 403);
    const session = cookieToken(request),
      initialHash = session ? await sha256(session) : null,
      actor = await actorForStart(env.DB, session);
    if (mode === "signin" && actor && data.confirmAccountSwitch !== true)
      throw failure("ACCOUNT_SWITCH_CONFIRMATION_REQUIRED", 409);
    let target = null,
      ticketHash = null;
    if (mode === "reconnect") {
      if (!actor) throw failure("LOGIN_REQUIRED", 401);
      if (request.headers.get("X-Studio-Account") !== actor.account_id)
        throw failure("ACCOUNT_CHANGED", 409);
      target = actor.account_id;
    }
    if (mode === "link") {
      if (
        data.confirmLink !== true ||
        typeof data.linkTicket !== "string" ||
        !/^[A-Za-z0-9_-]{40,128}$/.test(data.linkTicket)
      )
        throw failure("VERIFIED_LEGACY_PROOF_REQUIRED", 403);
      ticketHash = await sha256(data.linkTicket);
      const ticket = await env.DB.prepare(
        `SELECT t.account_id FROM cf_legacy_link_tickets t JOIN cf_accounts a ON a.id=t.account_id WHERE t.token_hash=? AND t.consumed_at IS NULL AND t.expires_at>${dbNow} AND a.status='active'`,
      )
        .bind(ticketHash)
        .first();
      if (!ticket) throw failure("VERIFIED_LEGACY_PROOF_REQUIRED", 403);
      target = ticket.account_id;
    }
    const bucket = await sha256(
      "auth-rate\0" +
        env.GOOGLE_TOKEN_KEY +
        "\0" +
        (request.headers.get("CF-Connecting-IP") || "local") +
        "\0" +
        Math.floor(Date.now() / lifetime),
    );
    const rate = await env.DB.prepare(
      "INSERT INTO cf_auth_rate_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    )
      .bind(bucket, Date.now() + lifetime)
      .first();
    if (rate.attempts > 20) throw failure("AUTH_RATE_LIMITED", 429);
    const state = randomToken(),
      stateHash = await sha256(state),
      browser = randomToken(),
      verifier = randomToken(),
      nonce = randomToken(),
      createdAt = Date.now(),
      payload = await seal(
        env,
        {
          verifier,
          nonce,
          createdAt,
          clientId: env.GOOGLE_CLIENT_ID,
          origin: env.APP_ORIGIN,
        },
        "attempt\0" + stateHash,
      );
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO cf_auth_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',NULL)",
      ).bind(
        stateHash,
        await sha256(browser),
        payload,
        mode,
        target,
        initialHash,
        actor?.account_id || null,
        actor?.connection_generation || null,
        ticketHash,
        Number(data.confirmCreateAccount === true),
        createdAt + lifetime,
      ),
      env.DB.prepare("DELETE FROM cf_auth_attempts WHERE expires_at<?").bind(
        createdAt,
      ),
      env.DB.prepare("DELETE FROM cf_auth_rate_limits WHERE expires_at<?").bind(
        createdAt - lifetime,
      ),
    ]);
    const challenge = base64url(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
      url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [key, value] of Object.entries({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.APP_ORIGIN + "/oauth/google/callback",
      response_type: "code",
      scope: requiredScopes.join(" "),
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "select_account consent",
      include_granted_scopes: "true",
    }))
      url.searchParams.set(key, value);
    return response({ url: url.href, requiredScopes }, 200, [
      cookie("__Host-studio_oauth", browser, 600),
    ]);
  }
  async function callback(request, env) {
    if (!configured(env)) throw failure("GOOGLE_CONFIGURATION_REQUIRED", 503);
    const url = new URL(request.url),
      state = url.searchParams.get("state"),
      browser = readCookie(request, "__Host-studio_oauth");
    if (!state || !/^[A-Za-z0-9_-]{40,128}$/.test(state) || !browser)
      throw failure("INVALID_AUTH_STATE", 401);
    if (url.searchParams.getAll("state").length !== 1)
      throw failure("INVALID_AUTH_STATE", 401);
    const hash = await sha256(state),
      claim = randomToken(),
      attempt = await env.DB.prepare(
        `UPDATE cf_auth_attempts SET status='processing',claim=? WHERE state_hash=? AND browser_hash=? AND status='pending' AND expires_at>${dbNow} RETURNING *`,
      )
        .bind(claim, hash, await sha256(browser))
        .first();
    if (!attempt) throw failure("AUTH_STATE_EXPIRED_OR_REPLAYED", 401);
    if (attempt.mode === "link") throw failure("LEGACY_LINK_DISABLED", 403);
    try {
      const current = cookieToken(request),
        currentHash = current ? await sha256(current) : null;
      if (currentHash !== attempt.initial_session_hash)
        throw failure("ACCOUNT_CHANGED_DURING_AUTH", 401);
      if (attempt.initial_actor)
        await authority(env.DB, currentHash, Date.now(), {
          setupRequired: false,
        });
      if (url.searchParams.has("error"))
        throw failure("GOOGLE_CONSENT_DENIED", 403);
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) throw failure("INVALID_AUTH_CODE");
      const saved = await unseal(env, attempt.payload, "attempt\0" + hash);
      if (
        typeof saved.verifier !== "string" ||
        !/^[A-Za-z0-9_-]{40,128}$/.test(saved.verifier) ||
        typeof saved.nonce !== "string" ||
        !/^[A-Za-z0-9_-]{40,128}$/.test(saved.nonce) ||
        !Number.isFinite(saved.createdAt)
      )
        throw failure("INVALID_AUTH_STATE", 401);
      if (
        saved.clientId !== env.GOOGLE_CLIENT_ID ||
        saved.origin !== env.APP_ORIGIN
      )
        throw failure("GOOGLE_CONFIGURATION_CHANGED", 401);
      const grant = await provider.json("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.APP_ORIGIN + "/oauth/google/callback",
          grant_type: "authorization_code",
          code_verifier: saved.verifier,
        }).toString(),
      });
      if (
        typeof grant.token_type !== "string" ||
        grant.token_type.toLowerCase() !== "bearer" ||
        typeof grant.access_token !== "string" ||
        !grant.access_token ||
        grant.access_token.length > 16384 ||
        typeof grant.scope !== "string" ||
        grant.scope.length > 8192 ||
        !Number.isFinite(grant.expires_in) ||
        grant.expires_in <= 0 ||
        grant.expires_in > 86400 ||
        (grant.refresh_token !== undefined &&
          (typeof grant.refresh_token !== "string" ||
            !grant.refresh_token ||
            grant.refresh_token.length > 16384))
      )
        throw failure("INVALID_GOOGLE_RESPONSE", 502);
      const identity = await verifyGoogleIdentity(grant.id_token, {
          clientId: env.GOOGLE_CLIENT_ID,
          nonce: saved.nonce,
          createdAt: saved.createdAt,
          fetchJson: provider.json,
        }),
        mapping = await env.DB.prepare(
          "SELECT account_id FROM cf_google_identities WHERE issuer=? AND subject=?",
        )
          .bind(identity.issuer, identity.subject)
          .first();
      let accountId = mapping?.account_id || attempt.target_account;
      if (
        attempt.target_account &&
        mapping &&
        mapping.account_id !== attempt.target_account
      )
        throw failure("GOOGLE_IDENTITY_ALREADY_LINKED", 409);
      if (
        attempt.mode === "reconnect" &&
        mapping?.account_id !== attempt.target_account
      )
        throw failure("GOOGLE_ACCOUNT_MISMATCH", 409);
      if (!accountId) {
        if (!attempt.allow_new)
          throw failure("ACCOUNT_LINK_OR_SIGNUP_REQUIRED", 409);
        accountId =
          "google-" +
          (await sha256(identity.issuer + "\0" + identity.subject)).slice(
            0,
            40,
          );
      }
      const account = await env.DB.prepare(
        "SELECT status FROM cf_accounts WHERE id=?",
      )
        .bind(accountId)
        .first();
      if (account && account.status !== "active")
        throw failure("ACCOUNT_DISABLED", 403);
      if (attempt.target_account && !account)
        throw failure("ACCOUNT_LINK_CHANGED", 409);
      const prior = await env.DB.prepare(
          "SELECT * FROM cf_connections WHERE account_id=?",
        )
          .bind(accountId)
          .first(),
        old = await env.DB.prepare(
          "SELECT * FROM cf_google_tokens WHERE account_id=?",
        )
          .bind(accountId)
          .first(),
        scopes = [...new Set(grant.scope.trim().split(/\s+/))].sort();
      let previousCredentials = null;
      if (
        old &&
        old.generation === prior?.generation &&
        prior.revoked_at === null
      )
        try {
          previousCredentials = await unseal(
            env,
            old.sealed,
            accountId + "\0" + old.generation + "\0google",
          );
        } catch {
          /* A changed key/context requires fresh consent. */
        }
      const sameClient = previousCredentials?.clientId === env.GOOGLE_CLIENT_ID;
      let refresh = grant.refresh_token || null;
      if (
        !refresh &&
        sameClient &&
        requiredScopes.every((scope) => scopes.includes(scope))
      )
        refresh = previousCredentials.refreshToken || null;
      let setup;
      try {
        setup = await provider.readiness(
          grant.access_token,
          scopes,
          identity.subject,
          Boolean(refresh),
        );
      } catch (error) {
        if (error.code === "GOOGLE_GRANT_REVOKED" && prior)
          await revokeLocalConnection(env.DB, accountId, prior.generation);
        throw error;
      }
      const ready =
          setup.drive === "verified" &&
          setup.calendar === "verified" &&
          requiredScopes.every((scope) => scopes.includes(scope)),
        // Each credential replacement gets its own generation. A delayed refresh
        // or readiness failure from an older login cannot revoke the new grant.
        generation = randomToken(),
        session = randomToken(),
        sessionHash = await sha256(session),
        sealed = await seal(
          env,
          {
            accessToken: grant.access_token,
            refreshToken: refresh,
            clientId: env.GOOGLE_CLIENT_ID,
          },
          accountId + "\0" + generation + "\0google",
        ),
        fence = randomToken(),
        now = Date.now();
      const actorPredicate = `(? IS NULL OR EXISTS(SELECT 1 FROM cf_sessions s JOIN cf_accounts a ON a.id=s.account_id JOIN cf_connections c ON c.account_id=a.id WHERE s.token_hash=? AND s.account_id=? AND s.connection_generation=? AND s.expires_at>${dbNow} AND s.revoked_at IS NULL AND a.status='active' AND c.generation=s.connection_generation AND c.revoked_at IS NULL))`,
        ticketPredicate = `(? IS NULL OR EXISTS(SELECT 1 FROM cf_legacy_link_tickets t JOIN cf_accounts a ON a.id=t.account_id WHERE t.token_hash=? AND t.account_id=? AND t.consumed_at IS NULL AND t.expires_at>${dbNow} AND a.status='active'))`;
      const statements = [
        env.DB.prepare(
          `INSERT INTO cf_write_fences VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM cf_auth_attempts WHERE state_hash=? AND claim=? AND status='processing' AND expires_at>${dbNow}) AND ${actorPredicate} AND ${ticketPredicate} AND COALESCE((SELECT generation FROM cf_connections WHERE account_id=?),'')=? AND NOT EXISTS(SELECT 1 FROM cf_accounts WHERE id=? AND status<>'active') AND (?=0 OR EXISTS(SELECT 1 FROM cf_accounts WHERE id=? AND status='active')) AND (? IS NULL OR EXISTS(SELECT 1 FROM cf_google_identities WHERE issuer=? AND subject=? AND account_id=?)) THEN 1 ELSE 0 END)`,
        ).bind(
          fence,
          hash,
          claim,
          attempt.initial_actor,
          attempt.initial_session_hash,
          attempt.initial_actor,
          attempt.initial_generation,
          attempt.link_ticket_hash,
          attempt.link_ticket_hash,
          accountId,
          accountId,
          prior?.generation || "",
          accountId,
          Number(Boolean(account)),
          accountId,
          mapping?.account_id || null,
          identity.issuer,
          identity.subject,
          mapping?.account_id || null,
        ),
        env.DB.prepare(
          "INSERT INTO cf_accounts(id,status,display_name,created_at) VALUES(?,'active',?,?) ON CONFLICT(id) DO NOTHING",
        ).bind(accountId, identity.name, now),
        env.DB.prepare(
          "INSERT INTO cf_google_identities VALUES(?,?,?) ON CONFLICT(issuer,subject) DO UPDATE SET account_id=CASE WHEN account_id=excluded.account_id THEN account_id ELSE NULL END",
        ).bind(identity.issuer, identity.subject, accountId),
        env.DB.prepare(
          "INSERT INTO cf_connections VALUES(?,?,?,?,?,NULL) ON CONFLICT(account_id) DO UPDATE SET generation=excluded.generation,drive_status=excluded.drive_status,calendar_status=excluded.calendar_status,scopes_json=excluded.scopes_json,revoked_at=NULL",
        ).bind(
          accountId,
          generation,
          setup.drive,
          setup.calendar,
          JSON.stringify(scopes),
        ),
        env.DB.prepare(
          "INSERT INTO cf_google_tokens VALUES(?,?,?,?,?,?,NULL,NULL) ON CONFLICT(account_id) DO UPDATE SET generation=excluded.generation,sealed=excluded.sealed,access_expires_at=excluded.access_expires_at,refresh_available=excluded.refresh_available,issue=excluded.issue,lease=NULL,lease_until=NULL",
        ).bind(
          accountId,
          generation,
          sealed,
          now + grant.expires_in * 1000,
          Number(Boolean(refresh)),
          setup.issue,
        ),
        env.DB.prepare("INSERT INTO cf_sessions VALUES(?,?,?,?,NULL)").bind(
          sessionHash,
          accountId,
          generation,
          now + 8 * 60 * 60 * 1000,
        ),
        env.DB.prepare(
          `UPDATE cf_auth_attempts SET status='complete',payload=NULL WHERE state_hash=? AND claim=?`,
        ).bind(hash, claim),
        env.DB.prepare("DELETE FROM cf_write_fences WHERE id=?").bind(fence),
      ];
      if (attempt.link_ticket_hash)
        statements.splice(
          statements.length - 1,
          0,
          env.DB.prepare(
            "UPDATE cf_legacy_link_tickets SET consumed_at=? WHERE token_hash=?",
          ).bind(now, attempt.link_ticket_hash),
        );
      try {
        await env.DB.batch(statements);
      } catch {
        throw failure("AUTH_CONTEXT_CHANGED_RESTART_REQUIRED", 409);
      }
      return response(
        {
          account: { id: accountId },
          setup: {
            ready,
            drive: setup.drive,
            calendar: setup.calendar,
            issue: setup.issue,
            missingScopes: requiredScopes.filter(
              (scope) => !scopes.includes(scope),
            ),
          },
          authenticated: true,
        },
        200,
        [
          cookie("__Host-studio_session", session, 8 * 60 * 60),
          cookie("__Host-studio_oauth", "", 0),
        ],
      );
    } catch (error) {
      await env.DB.prepare(
        "UPDATE cf_auth_attempts SET status='failed',payload=NULL WHERE state_hash=? AND claim=? AND status='processing'",
      )
        .bind(hash, claim)
        .run();
      return response(
        { error: error.code || "GOOGLE_SIGNIN_FAILED" },
        error.status || 503,
        [cookie("__Host-studio_oauth", "", 0)],
      );
    }
  }
  async function verify(request, env) {
    if (!configured(env)) throw failure("GOOGLE_CONFIGURATION_REQUIRED", 503);
    const token = cookieToken(request);
    if (!token) throw failure("LOGIN_REQUIRED", 401);
    const hash = await sha256(token),
      actor = await authority(env.DB, hash, Date.now(), {
        setupRequired: false,
      });
    if (
      request.headers.get("Origin") !== env.APP_ORIGIN ||
      request.headers.get("X-Studio-CSRF") !== (await sha256("csrf\0" + token))
    )
      throw failure("CSRF_TOKEN_REJECTED", 403);
    if (request.headers.get("X-Studio-Account") !== actor.account_id)
      throw failure("ACCOUNT_CHANGED", 409);
    try {
      const access = await googleAccessToken(env.DB, env, hash, provider),
        identity = await env.DB.prepare(
          "SELECT subject FROM cf_google_identities WHERE account_id=?",
        )
          .bind(actor.account_id)
          .first();
      if (!identity) throw failure("GOOGLE_RECONNECT_REQUIRED", 401);
      const row = await env.DB.prepare(
        "SELECT refresh_available FROM cf_google_tokens WHERE account_id=? AND generation=?",
      )
        .bind(actor.account_id, actor.generation)
        .first();
      const setup = await provider.readiness(
        access.token,
        JSON.parse(access.actor.scopes_json),
        identity.subject,
        Boolean(row?.refresh_available),
      );
      await authority(env.DB, hash, Date.now(), { setupRequired: false });
      await env.DB.prepare(
        "UPDATE cf_connections SET drive_status=?,calendar_status=? WHERE account_id=? AND generation=? AND revoked_at IS NULL",
      )
        .bind(setup.drive, setup.calendar, actor.account_id, actor.generation)
        .run();
      await authority(env.DB, hash, Date.now(), { setupRequired: false });
      return response({
        setup: {
          ready:
            setup.drive === "verified" &&
            setup.calendar === "verified" &&
            requiredScopes.every((scope) =>
              JSON.parse(access.actor.scopes_json).includes(scope),
            ),
          drive: setup.drive,
          calendar: setup.calendar,
          issue: setup.issue,
        },
      });
    } catch (error) {
      if (error.code === "GOOGLE_GRANT_REVOKED")
        await revokeLocalConnection(env.DB, actor.account_id, actor.generation);
      throw error;
    }
  }
  async function disconnect(request, env) {
    const token = cookieToken(request);
    if (!token) throw failure("LOGIN_REQUIRED", 401);
    const hash = await sha256(token),
      actor = await authority(env.DB, hash, Date.now(), {
        setupRequired: false,
      });
    if (
      request.headers.get("Origin") !== env.APP_ORIGIN ||
      request.headers.get("X-Studio-CSRF") !== (await sha256("csrf\0" + token))
    )
      throw failure("CSRF_TOKEN_REJECTED", 403);
    if (request.headers.get("X-Studio-Account") !== actor.account_id)
      throw failure("ACCOUNT_CHANGED", 409);
    const fence = randomToken(),
      now = Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO cf_write_fences VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM cf_sessions s JOIN cf_connections c ON c.account_id=s.account_id JOIN cf_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.account_id=? AND s.connection_generation=? AND s.expires_at>${dbNow} AND s.revoked_at IS NULL AND s.connection_generation=c.generation AND c.revoked_at IS NULL AND a.status='active') THEN 1 ELSE 0 END)`,
        ).bind(fence, hash, actor.account_id, actor.generation),
        env.DB.prepare(
          "UPDATE cf_connections SET generation=?,drive_status='revoked',calendar_status='revoked',revoked_at=? WHERE account_id=?",
        ).bind(randomToken(), now, actor.account_id),
        env.DB.prepare(
          "UPDATE cf_sessions SET revoked_at=? WHERE account_id=?",
        ).bind(now, actor.account_id),
        env.DB.prepare("DELETE FROM cf_google_tokens WHERE account_id=?").bind(
          actor.account_id,
        ),
        env.DB.prepare("DELETE FROM cf_write_fences WHERE id=?").bind(fence),
      ]);
    } catch {
      throw failure("DISCONNECT_CONTEXT_CHANGED", 409);
    }
    return response(
      { localDisconnected: true, providerGrantRevoked: false },
      200,
      [cookie("__Host-studio_session", "", 0)],
    );
  }
  return async (request, env) => {
    const path = new URL(request.url).pathname;
    if (path === "/api/edge/auth/bootstrap" && request.method === "GET") {
      const login = readCookie(request, "__Host-studio_login") || randomToken();
      let ready = configured(env);
      if (ready)
        try {
          await encryptionKey(env);
        } catch {
          ready = false;
        }
      return response(
        {
          configured: ready,
          csrfToken: await sha256("login-csrf\0" + login),
          requiredScopes,
          legacyProofIssuance: "separate-verified-process-required",
        },
        200,
        [cookie("__Host-studio_login", login, 600)],
      );
    }
    if (path === "/api/edge/auth/google/start" && request.method === "POST")
      return start(request, env);
    if (path === "/oauth/google/callback" && request.method === "GET")
      return callback(request, env);
    if (path === "/api/edge/auth/verify" && request.method === "POST")
      return verify(request, env);
    if (path === "/api/edge/auth/disconnect" && request.method === "POST")
      return disconnect(request, env);
    return null;
  };
}
