PRAGMA foreign_keys = ON;
-- New namespace: do not mutate or silently import the NAS schema.
CREATE TABLE cf_accounts (
 id TEXT PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN ('active','withdrawal_pending','disabled')),
 display_name TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE TABLE cf_role_bindings (
 account_id TEXT NOT NULL REFERENCES cf_accounts(id),
 role TEXT NOT NULL CHECK(role IN ('administrator','highest_administrator','delegated_administrator')),
 source TEXT NOT NULL CHECK(source IN ('reviewed_legacy_mapping','explicit_appointment')),
 PRIMARY KEY(account_id,role)
);
CREATE TABLE cf_google_identities (
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES cf_accounts(id),
 PRIMARY KEY(issuer,subject),
 UNIQUE(account_id)
);
CREATE TABLE cf_connections (
 account_id TEXT PRIMARY KEY REFERENCES cf_accounts(id),
 generation TEXT NOT NULL,
 drive_status TEXT NOT NULL CHECK(drive_status IN ('missing','partial','verified','revoked')),
 calendar_status TEXT NOT NULL CHECK(calendar_status IN ('missing','partial','verified','revoked')),
 scopes_json TEXT NOT NULL CHECK(json_valid(scopes_json)),
 revoked_at INTEGER
);
CREATE TABLE cf_sessions (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES cf_accounts(id),
 connection_generation TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX cf_sessions_account ON cf_sessions(account_id);
CREATE TABLE cf_resource_heads (
 account_id TEXT NOT NULL REFERENCES cf_accounts(id),
 resource TEXT NOT NULL CHECK(resource IN ('documents')),
 revision INTEGER NOT NULL CHECK(revision > 0),
 generation TEXT NOT NULL,
 digest TEXT NOT NULL,
 chunk_count INTEGER NOT NULL CHECK(chunk_count BETWEEN 1 AND 20),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,resource)
);
CREATE TABLE cf_resource_chunks (
 account_id TEXT NOT NULL REFERENCES cf_accounts(id),
 resource TEXT NOT NULL CHECK(resource IN ('documents')),
 generation TEXT NOT NULL,
 part INTEGER NOT NULL CHECK(part >= 0),
 bytes BLOB NOT NULL CHECK(length(bytes) <= 512000),
 PRIMARY KEY(account_id,resource,generation,part)
);
-- A failed authority/revision assertion aborts the complete D1 batch.
CREATE TABLE cf_write_fences (
 id TEXT PRIMARY KEY,
 authorized INTEGER NOT NULL CHECK(authorized=1)
);
