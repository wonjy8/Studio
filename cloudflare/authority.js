export const requiredScopes = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]);
export const failure = (code, status = 400) =>
  Object.assign(Error(code), { code, status });
export async function sha256(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export const authoritySql = `SELECT s.account_id,s.connection_generation,a.status,c.generation,c.drive_status,c.calendar_status,c.scopes_json,c.revoked_at AS connection_revoked FROM cf_sessions s JOIN cf_accounts a ON a.id=s.account_id LEFT JOIN cf_connections c ON c.account_id=a.id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`;
export const writeAuthoritySql = `EXISTS(SELECT 1 FROM cf_sessions s JOIN cf_accounts a ON a.id=s.account_id JOIN cf_connections c ON c.account_id=a.id WHERE s.token_hash=? AND s.account_id=? AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND a.status='active' AND c.generation=s.connection_generation AND c.revoked_at IS NULL AND c.drive_status='verified' AND c.calendar_status='verified' AND NOT EXISTS(SELECT 1 FROM json_each(?) required WHERE NOT EXISTS(SELECT 1 FROM json_each(c.scopes_json) granted WHERE granted.value=required.value)))`;
export function cookieToken(request) {
  const values = (request.headers.get("Cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith("__Host-studio_session="));
  if (values.length !== 1) return null;
  const token = values[0].slice("__Host-studio_session=".length);
  return /^[A-Za-z0-9_-]{40,128}$/.test(token) ? token : null;
}
export async function authority(
  db,
  tokenHash,
  now = Date.now(),
  { setupRequired = true } = {},
) {
  const row = await db.prepare(authoritySql).bind(tokenHash, now).first();
  if (
    !row ||
    row.status !== "active" ||
    row.connection_revoked !== null ||
    row.generation !== row.connection_generation
  )
    throw failure("SESSION_REVOKED_OR_ACCOUNT_CHANGED", 401);
  let scopes;
  try {
    scopes = JSON.parse(row.scopes_json);
  } catch {
    throw failure("INVALID_CONNECTION_STATE", 503);
  }
  if (!Array.isArray(scopes) || scopes.some((v) => typeof v !== "string"))
    throw failure("INVALID_CONNECTION_STATE", 503);
  const missing = requiredScopes.filter((scope) => !scopes.includes(scope));
  const ready =
    row.drive_status === "verified" &&
    row.calendar_status === "verified" &&
    !missing.length;
  if (setupRequired && !ready) throw failure("GOOGLE_SETUP_REQUIRED", 403);
  return { ...row, ready, missing };
}
