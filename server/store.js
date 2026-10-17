import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
export function openStore(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, 'studio.sqlite'));
  chmodSync(join(dir, 'studio.sqlite'), 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, expires INTEGER NOT NULL, used_at INTEGER, revoked_at INTEGER);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces(user_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, type TEXT NOT NULL, bytes BLOB NOT NULL);
  `);
  const inviteColumns=db.prepare('PRAGMA table_info(invitations)').all().map(c=>c.name);
  if(!inviteColumns.includes('max_uses')||!inviteColumns.includes('use_count')){
    db.exec('BEGIN IMMEDIATE');
    try{
      if(!inviteColumns.includes('max_uses'))db.exec('ALTER TABLE invitations ADD COLUMN max_uses INTEGER DEFAULT 1');
      if(!inviteColumns.includes('use_count')){db.exec('ALTER TABLE invitations ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0');db.exec('UPDATE invitations SET use_count=1 WHERE used_at IS NOT NULL');}
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  // Preserve the owner on upgrade, using the earliest retained login; fall back to the first provisioned account.
  const owner=db.prepare('SELECT user_id AS id FROM sessions ORDER BY rowid LIMIT 1').get() || db.prepare('SELECT id FROM users ORDER BY rowid LIMIT 1').get();
  if(owner) db.prepare("INSERT OR IGNORE INTO site_settings VALUES('admin_user_id',?)").run(owner.id);
  return db;
}
