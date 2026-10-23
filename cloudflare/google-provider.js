import { failure, requiredScopes } from "./authority.js";
export function googleProvider(fetcher = fetch) {
  async function json(url, options = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(url, {
          ...options,
          signal: controller.signal,
          redirect: "manual",
        }),
        reader = response.body?.getReader();
      if (response.status >= 300 && response.status < 400) {
        await reader?.cancel();
        throw failure("GOOGLE_REDIRECT_REJECTED", 502);
      }
      let data = "",
        bytes = 0;
      if (reader) {
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.length;
            data += decoder.decode(value, { stream: true });
            if (bytes > 131072) {
              await reader.cancel();
              throw failure("GOOGLE_RESPONSE_TOO_LARGE", 502);
            }
          }
          data += decoder.decode();
        } finally {
          reader.releaseLock();
        }
      }
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        throw failure("INVALID_GOOGLE_RESPONSE", 502);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw failure("INVALID_GOOGLE_RESPONSE", 502);
      if (!response.ok) {
        const code =
          parsed?.error === "invalid_grant"
            ? "GOOGLE_GRANT_REVOKED"
            : response.status === 401
              ? "GOOGLE_GRANT_REVOKED"
              : response.status === 403
                ? "GOOGLE_PERMISSION_DENIED"
                : response.status === 429
                  ? "GOOGLE_RATE_LIMITED"
                  : "GOOGLE_SERVICE_UNAVAILABLE";
        throw failure(
          code,
          code === "GOOGLE_GRANT_REVOKED"
            ? 401
            : response.status === 403
              ? 403
              : 502,
        );
      }
      return parsed;
    } catch (error) {
      if (error.code) throw error;
      throw failure("GOOGLE_SERVICE_UNAVAILABLE", 502);
    } finally {
      clearTimeout(timer);
    }
  }
  async function readiness(accessToken, scopes, subject, hasRefresh) {
    const headers = { Authorization: "Bearer " + accessToken },
      driveScope = "https://www.googleapis.com/auth/drive.file",
      calendarScopes = requiredScopes.filter((s) => s.includes("/calendar."));
    let drive = scopes.includes(driveScope) ? "partial" : "missing",
      calendar = calendarScopes.every((s) => scopes.includes(s))
        ? "partial"
        : "missing",
      issue = hasRefresh ? null : "GOOGLE_OFFLINE_CONSENT_REQUIRED";
    const who = await json("https://openidconnect.googleapis.com/v1/userinfo", {
      headers,
    });
    if (who.sub !== subject) throw failure("GOOGLE_ACCOUNT_MISMATCH", 401);
    if (drive !== "missing")
      try {
        const about = await json(
          "https://www.googleapis.com/drive/v3/about?fields=user(permissionId)",
          { headers },
        );
        if (
          typeof about.user?.permissionId !== "string" ||
          !about.user.permissionId
        )
          throw failure("INVALID_GOOGLE_RESPONSE", 502);
        if (hasRefresh) drive = "verified";
      } catch (error) {
        if (error.code === "GOOGLE_GRANT_REVOKED") throw error;
        issue = error.code;
      }
    if (calendar !== "missing")
      try {
        let pageToken = null;
        const seen = new Set();
        for (let page = 0; page < 20; page++) {
          const url = new URL(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
          );
          url.searchParams.set("maxResults", "250");
          url.searchParams.set("fields", "items(id,accessRole),nextPageToken");
          if (pageToken) url.searchParams.set("pageToken", pageToken);
          const list = await json(url.href, { headers });
          if (!Array.isArray(list.items))
            throw failure("INVALID_GOOGLE_RESPONSE", 502);
          if (
            hasRefresh &&
            list.items.some(
              (c) =>
                typeof c.id === "string" &&
                ["owner", "writer"].includes(c.accessRole),
            )
          ) {
            calendar = "verified";
            break;
          }
          const next = list.nextPageToken;
          if (next === undefined || next === "") break;
          if (typeof next !== "string" || next.length > 4096 || seen.has(next))
            throw failure("INVALID_GOOGLE_RESPONSE", 502);
          seen.add(next);
          pageToken = next;
          if (page === 19)
            throw failure("GOOGLE_CALENDAR_PAGINATION_LIMIT", 502);
        }
        if (calendar !== "verified")
          issue = "GOOGLE_WRITABLE_CALENDAR_REQUIRED";
      } catch (error) {
        if (error.code === "GOOGLE_GRANT_REVOKED") throw error;
        issue = error.code;
      }
    return { drive, calendar, issue };
  }
  return { json, readiness };
}
