CREATE TABLE cf_auth_attempts (
 state_hash TEXT PRIMARY KEY,
 browser_hash TEXT NOT NULL,
 payload TEXT,
 mode TEXT NOT NULL CHECK(mode IN ('signin','reconnect','link')),
 target_account TEXT,
 initial_session_hash TEXT,
 initial_actor TEXT,
 initial_generation TEXT,
 link_ticket_hash TEXT,
 allow_new INTEGER NOT NULL CHECK(allow_new IN (0,1)),
 expires_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','processing','complete','failed')),
 claim TEXT
);
CREATE INDEX cf_auth_attempts_expiry ON cf_auth_attempts(expires_at);
CREATE TABLE cf_auth_rate_limits (
 bucket TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
-- Issuance requires a separately verified legacy-account proof process.
-- No public ticket-creation endpoint is exposed.
CREATE TABLE cf_legacy_link_tickets (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES cf_accounts(id),
 proof_kind TEXT NOT NULL CHECK(proof_kind IN ('verified_legacy_session','operator_reviewed')),
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER
);
CREATE TABLE cf_google_tokens (
 account_id TEXT PRIMARY KEY REFERENCES cf_accounts(id),
 generation TEXT NOT NULL,
 sealed TEXT NOT NULL,
 access_expires_at INTEGER NOT NULL,
 refresh_available INTEGER NOT NULL CHECK(refresh_available IN (0,1)),
 issue TEXT,
 lease TEXT,
 lease_until INTEGER
);
