import { authority, failure, requiredScopes } from "./authority.js";
import { randomToken, seal, unseal } from "./google-crypto.js";
const dbNow = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
export async function revokeLocalConnection(db, accountId, generation) {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        "UPDATE cf_sessions SET revoked_at=? WHERE account_id=? AND connection_generation=?",
      )
      .bind(now, accountId, generation),
    db
      .prepare(
        "DELETE FROM cf_google_tokens WHERE account_id=? AND generation=?",
      )
      .bind(accountId, generation),
    db
      .prepare(
        "UPDATE cf_connections SET generation=?,drive_status='revoked',calendar_status='revoked',revoked_at=? WHERE account_id=? AND generation=?",
      )
      .bind(randomToken(), now, accountId, generation),
  ]);
}
export async function googleAccessToken(db, env, hash, provider) {
  const actor = await authority(db, hash, Date.now(), { setupRequired: false }),
    row = await db
      .prepare(
        "SELECT * FROM cf_google_tokens WHERE account_id=? AND generation=?",
      )
      .bind(actor.account_id, actor.generation)
      .first();
  if (!row) throw failure("GOOGLE_RECONNECT_REQUIRED", 401);
  const tokens = await unseal(
    env,
    row.sealed,
    actor.account_id + "\0" + row.generation + "\0google",
  );
  if (tokens.clientId !== env.GOOGLE_CLIENT_ID)
    throw failure("GOOGLE_CONFIGURATION_CHANGED", 401);
  if (row.access_expires_at > Date.now() + 60000)
    return { token: tokens.accessToken, actor };
  if (!tokens.refreshToken)
    throw failure("GOOGLE_OFFLINE_CONSENT_REQUIRED", 403);
  const lease = randomToken(),
    locked = await db
      .prepare(
        `UPDATE cf_google_tokens SET lease=?,lease_until=? WHERE account_id=? AND generation=? AND (lease_until IS NULL OR lease_until<${dbNow}) RETURNING account_id`,
      )
      .bind(lease, Date.now() + 30000, actor.account_id, row.generation)
      .first();
  if (!locked) throw failure("TOKEN_REFRESH_IN_PROGRESS", 409);
  try {
    const result = await provider.json("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
      }).toString(),
    });
    if (
      typeof result.access_token !== "string" ||
      !result.access_token ||
      result.access_token.length > 16384 ||
      typeof result.token_type !== "string" ||
      result.token_type.toLowerCase() !== "bearer" ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0 ||
      result.expires_in > 86400 ||
      (result.refresh_token !== undefined &&
        (typeof result.refresh_token !== "string" ||
          !result.refresh_token ||
          result.refresh_token.length > 16384)) ||
      (result.scope !== undefined &&
        (typeof result.scope !== "string" || result.scope.length > 8192))
    )
      throw failure("INVALID_GOOGLE_RESPONSE", 502);
    const scopes =
        result.scope === undefined
          ? JSON.parse(actor.scopes_json)
          : [...new Set(result.scope.split(/\s+/))],
      sealed = await seal(
        env,
        {
          ...tokens,
          accessToken: result.access_token,
          refreshToken: result.refresh_token || tokens.refreshToken,
        },
        actor.account_id + "\0" + row.generation + "\0google",
      );
    const updated = await db
      .prepare(
        `UPDATE cf_google_tokens SET sealed=?,access_expires_at=?,lease=NULL,lease_until=NULL WHERE account_id=? AND generation=? AND lease=? AND EXISTS(SELECT 1 FROM cf_sessions s JOIN cf_accounts a ON a.id=s.account_id JOIN cf_connections c ON c.account_id=a.id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>${dbNow} AND a.status='active' AND s.connection_generation=c.generation AND c.generation=? AND c.revoked_at IS NULL) RETURNING account_id`,
      )
      .bind(
        sealed,
        Date.now() + result.expires_in * 1000,
        actor.account_id,
        row.generation,
        lease,
        hash,
        row.generation,
      )
      .first();
    if (!updated) throw failure("SESSION_REVOKED_OR_ACCOUNT_CHANGED", 401);
    if (!requiredScopes.every((scope) => scopes.includes(scope)))
      await db
        .prepare(
          "UPDATE cf_connections SET scopes_json=?,drive_status='partial',calendar_status='partial' WHERE account_id=? AND generation=? AND revoked_at IS NULL",
        )
        .bind(JSON.stringify(scopes), actor.account_id, row.generation)
        .run();
    await authority(db, hash, Date.now(), { setupRequired: false });
    return {
      token: result.access_token,
      actor: { ...actor, scopes_json: JSON.stringify(scopes) },
    };
  } catch (error) {
    if (error.code === "GOOGLE_GRANT_REVOKED")
      await revokeLocalConnection(db, actor.account_id, row.generation);
    throw error;
  } finally {
    await db
      .prepare(
        "UPDATE cf_google_tokens SET lease=NULL,lease_until=NULL WHERE account_id=? AND generation=? AND lease=?",
      )
      .bind(actor.account_id, row.generation, lease)
      .run();
  }
}
