import { validDocuments } from "../src/domain/documents.js";
import {
  authority,
  writeAuthoritySql,
  requiredScopes,
  sha256,
  failure,
} from "./authority.js";
export const resourceLimit = 8 * 1024 * 1024,
  chunkLimit = 512000;
function bytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw failure("CORRUPT_RESOURCE", 503);
}
export async function readDocuments(db, tokenHash) {
  const actor = await authority(db, tokenHash),
    rows = (
      await db
        .prepare(
          `SELECT h.revision,h.digest,h.chunk_count,c.part,c.bytes FROM cf_resource_heads h LEFT JOIN cf_resource_chunks c ON c.account_id=h.account_id AND c.resource=h.resource AND c.generation=h.generation WHERE h.account_id=? AND h.resource='documents' ORDER BY c.part`,
        )
        .bind(actor.account_id)
        .all()
    ).results;
  let result = { documents: [], revision: 0 };
  if (rows.length) {
    if (
      rows.length !== rows[0].chunk_count ||
      rows.some((r, i) => r.part !== i)
    )
      throw failure("CORRUPT_RESOURCE", 503);
    const chunks = rows.map((r) => bytes(r.bytes)),
      size = chunks.reduce((n, c) => n + c.length, 0);
    if (size > resourceLimit) throw failure("CORRUPT_RESOURCE", 503);
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    if ((await sha256(body)) !== rows[0].digest)
      throw failure("CORRUPT_RESOURCE", 503);
    let documents;
    try {
      documents = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(body),
      );
    } catch {
      throw failure("CORRUPT_RESOURCE", 503);
    }
    if (!validDocuments(documents)) throw failure("CORRUPT_RESOURCE", 503);
    result = { documents, revision: rows[0].revision };
  }
  await authority(db, tokenHash);
  return result;
}
export async function writeDocuments(db, tokenHash, input, { signal } = {}) {
  if (
    !input ||
    Object.keys(input).some((k) => !["documents", "revision"].includes(k)) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    !validDocuments(input.documents)
  )
    throw failure("INVALID_DOCUMENTS");
  const body = new TextEncoder().encode(JSON.stringify(input.documents));
  if (body.length > resourceLimit) throw failure("RESOURCE_TOO_LARGE", 413);
  const actor = await authority(db, tokenHash),
    digest = await sha256(body),
    head = await db
      .prepare(
        "SELECT revision,digest FROM cf_resource_heads WHERE account_id=? AND resource='documents'",
      )
      .bind(actor.account_id)
      .first();
  if (head?.digest === digest) {
    await authority(db, tokenHash);
    return { documents: input.documents, revision: head.revision };
  }
  if (signal?.aborted) throw failure("REQUEST_CANCELLED", 409);
  const now = Date.now(),
    generation = crypto.randomUUID(),
    fence = crypto.randomUUID(),
    count = Math.max(1, Math.ceil(body.length / chunkLimit));
  const statements = [
    db
      .prepare(
        `INSERT INTO cf_write_fences(id,authorized) VALUES(?,CASE WHEN ${writeAuthoritySql} AND COALESCE((SELECT revision FROM cf_resource_heads WHERE account_id=? AND resource='documents'),0)=? THEN 1 ELSE 0 END)`,
      )
      .bind(
        fence,
        tokenHash,
        actor.account_id,
        JSON.stringify(requiredScopes),
        actor.account_id,
        input.revision,
      ),
  ];
  for (let part = 0; part < count; part++)
    statements.push(
      db
        .prepare(
          "INSERT INTO cf_resource_chunks(account_id,resource,generation,part,bytes) VALUES(?,'documents',?,?,?)",
        )
        .bind(
          actor.account_id,
          generation,
          part,
          body.slice(part * chunkLimit, (part + 1) * chunkLimit).buffer,
        ),
    );
  statements.push(
    db
      .prepare(
        "INSERT INTO cf_resource_heads(account_id,resource,revision,generation,digest,chunk_count,updated_at) VALUES(?,'documents',?,?,?,?,?) ON CONFLICT(account_id,resource) DO UPDATE SET revision=excluded.revision,generation=excluded.generation,digest=excluded.digest,chunk_count=excluded.chunk_count,updated_at=excluded.updated_at",
      )
      .bind(
        actor.account_id,
        input.revision + 1,
        generation,
        digest,
        count,
        now,
      ),
    db
      .prepare(
        "DELETE FROM cf_resource_chunks WHERE account_id=? AND resource='documents' AND generation<>?",
      )
      .bind(actor.account_id, generation),
    db.prepare("DELETE FROM cf_write_fences WHERE id=?").bind(fence),
  );
  try {
    await db.batch(statements);
  } catch {
    await authority(db, tokenHash);
    const current = await db
      .prepare(
        "SELECT revision,digest FROM cf_resource_heads WHERE account_id=? AND resource='documents'",
      )
      .bind(actor.account_id)
      .first();
    if (current?.digest === digest)
      return { documents: input.documents, revision: current.revision };
    if ((current?.revision || 0) !== input.revision)
      throw failure("REVISION_CONFLICT", 409);
    throw failure("DATABASE_WRITE_FAILED", 503);
  }
  await authority(db, tokenHash);
  return { documents: input.documents, revision: input.revision + 1 };
}
