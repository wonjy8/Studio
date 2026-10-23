import { failure } from "./authority.js";
export async function readBoundedJson(request, limit) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("Content-Type") || "",
    )
  )
    throw failure("JSON_REQUIRED", 415);
  const reader = request.body?.getReader();
  if (!reader) throw failure("INVALID_JSON");
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw failure("RESOURCE_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error.status) throw error;
    throw failure("INVALID_JSON");
  } finally {
    reader.releaseLock();
  }
}
