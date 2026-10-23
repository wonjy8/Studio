import { page, css, script } from "./ui/page.js";
import { createGoogleAuth } from "./google-auth.js";
import { readBoundedJson } from "./http.js";
import {
  authority,
  cookieToken,
  sha256,
  failure,
  requiredScopes,
} from "./authority.js";
import { readDocuments, writeDocuments, resourceLimit } from "./documents.js";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });
export function createWorker({ googleFetcher } = {}) {
  const googleAuth = createGoogleAuth(
    googleFetcher ? { fetcher: googleFetcher } : {},
  );
  return {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        if (url.pathname === "/health")
          return json({
            ok: true,
            runtime: "cloudflare-workers",
            readiness: "foundation-only",
            revision: /^[a-f0-9]{40}$/.test(env.REVISION || "")
              ? env.REVISION
              : "development",
          });
        if (
          !env.APP_ORIGIN ||
          new URL(env.APP_ORIGIN).origin !== env.APP_ORIGIN ||
          !env.APP_ORIGIN.startsWith("https://")
        )
          throw failure("EDGE_CONFIGURATION_REQUIRED", 503);
        if (url.origin !== env.APP_ORIGIN)
          throw failure("ORIGIN_MISMATCH", 421);
        if (!env.DB) throw failure("D1_BINDING_REQUIRED", 503);
        const uiHeaders = {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy":
            "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        };
        if (
          request.method === "GET" &&
          [
            "/",
            "/login",
            "/setup",
            "/auth/complete",
            "/edge-ui.js",
            "/edge-ui.css",
          ].includes(url.pathname)
        ) {
          const js = url.pathname === "/edge-ui.js",
            style = url.pathname === "/edge-ui.css";
          return new Response(js ? script : style ? css : page, {
            headers: {
              ...uiHeaders,
              "Content-Type": js
                ? "text/javascript; charset=utf-8"
                : style
                  ? "text/css; charset=utf-8"
                  : "text/html; charset=utf-8",
            },
          });
        }
        const authResponse = await googleAuth(request, env);
        if (authResponse) {
          if (
            url.pathname === "/oauth/google/callback" &&
            request.headers.get("Accept")?.includes("text/html")
          ) {
            const handoff = new Headers(uiHeaders);
            handoff.set(
              "Location",
              authResponse.ok
                ? "/auth/complete"
                : "/auth/complete?result=failed",
            );
            for (const cookie of authResponse.headers.getSetCookie())
              handoff.append("Set-Cookie", cookie);
            return new Response(null, { status: 303, headers: handoff });
          }
          return authResponse;
        }
        if (
          !["/api/edge/session", "/api/edge/documents"].includes(url.pathname)
        )
          return json(
            {
              error: "EDGE_RESOURCE_NOT_PORTED",
              implemented: ["session/setup-state", "own-document-library"],
              pending: [
                "complete workspace UI",
                "Drive storage",
                "calendar/jobs",
                "remaining Studio APIs/UI",
              ],
            },
            501,
          );
        const token = cookieToken(request);
        if (!token) throw failure("LOGIN_REQUIRED", 401);
        const hash = await sha256(token);
        if (url.pathname === "/api/edge/session" && request.method === "GET") {
          const actor = await authority(env.DB, hash, Date.now(), {
              setupRequired: false,
            }),
            roles = (
              await env.DB.prepare(
                "SELECT role FROM cf_role_bindings WHERE account_id=? ORDER BY role",
              )
                .bind(actor.account_id)
                .all()
            ).results.map((row) => row.role);
          await authority(env.DB, hash, Date.now(), { setupRequired: false });
          return json({
            account: { id: actor.account_id },
            roles,
            setup: {
              ready: actor.ready,
              requiredScopes,
              missingScopes: actor.missing,
              drive: actor.drive_status,
              calendar: actor.calendar_status,
            },
            csrfToken: await sha256("csrf\0" + token),
          });
        }
        if (url.pathname === "/api/edge/documents") {
          if (request.method === "GET") {
            const actor = await authority(env.DB, hash);
            if (request.headers.get("X-Studio-Account") !== actor.account_id)
              throw failure("ACCOUNT_CHANGED", 409);
            return json(await readDocuments(env.DB, hash));
          }
          if (request.method === "PUT") {
            await authority(env.DB, hash);
            if (request.headers.get("Origin") !== env.APP_ORIGIN)
              throw failure("CSRF_ORIGIN_REJECTED", 403);
            if (
              request.headers.get("X-Studio-CSRF") !==
              (await sha256("csrf\0" + token))
            )
              throw failure("CSRF_TOKEN_REJECTED", 403);
            const actor = await authority(env.DB, hash);
            if (request.headers.get("X-Studio-Account") !== actor.account_id)
              throw failure("ACCOUNT_CHANGED", 409);
            return json(
              await writeDocuments(
                env.DB,
                hash,
                await readBoundedJson(request, resourceLimit),
                { signal: request.signal },
              ),
            );
          }
        }
        return json({ error: "METHOD_NOT_ALLOWED" }, 405);
      } catch (error) {
        return json(
          { error: error.code || "EDGE_STORAGE_UNAVAILABLE" },
          error.status || 503,
        );
      }
    },
  };
}
export default createWorker();
