// Password arrives through stdin, never command arguments, output, or committed configuration.
import { openStore } from '../server/store.js';
import { validPassword } from '../server/password-policy.js';
import { hashPassword } from '../server/auth.js';
import { randomUUID } from 'node:crypto';
const username = process.argv[2];
if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username || '')) throw Error('Supply a username (3–64 letters, digits, _, . or -).');
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, '');
if (!validPassword(password)) throw Error('Password must be 8–256 characters and include an uppercase letter and a special character (not whitespace).');
const db = openStore(process.env.DATA_DIR || './data');
const hash = await hashPassword(password);
const existing = db.prepare('SELECT id FROM users WHERE username=?').get(username);
if (existing) {
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
} else db.prepare('INSERT INTO users VALUES(?,?,?)').run(randomUUID(), username, hash);
db.close();
console.log('Account saved; existing sessions revoked.');
