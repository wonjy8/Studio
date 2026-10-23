// Bound provider text while it is arriving, before a full response allocation.
// Limits remain JS string characters, matching the existing integration contracts.
export async function limitedResponseText(response, maxCharacters, limitError) {
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 0)
    throw new TypeError('Invalid response character limit');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts = [];
  let length = 0;
  let complete = false;
  const append = value => {
    length += value.length;
    if (length > maxCharacters) throw limitError();
    if (value) parts.push(value);
  };
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      // UTF-8 needs at most three bytes per UTF-16 code unit, plus the
      // decoder's pending bytes/BOM. Reject a giant chunk before decoding it.
      if (value.byteLength > (maxCharacters - length) * 3 + 6)
        throw limitError();
      append(decoder.decode(value, {stream: true}));
    }
    append(decoder.decode());
    complete = true;
    return parts.join('');
  } finally {
    if (!complete) {
      try { await reader.cancel(); } catch { /* Already aborted/errored. */ }
    }
    reader.releaseLock();
  }
}
