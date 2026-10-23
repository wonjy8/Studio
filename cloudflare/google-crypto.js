import { failure } from "./authority.js";
export const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
export function decode64(value) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value))
    throw failure("INVALID_GOOGLE_RESPONSE", 401);
  try {
    return Uint8Array.from(
      atob(
        value.replaceAll("-", "+").replaceAll("_", "/") +
          "=".repeat((4 - (value.length % 4)) % 4),
      ),
      (c) => c.charCodeAt(0),
    );
  } catch {
    throw failure("INVALID_GOOGLE_RESPONSE", 401);
  }
}
export const randomToken = () =>
  base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function encryptionKey(env) {
  let bytes;
  try {
    bytes = decode64(env.GOOGLE_TOKEN_KEY);
  } catch {
    throw failure("GOOGLE_CONFIGURATION_REQUIRED", 503);
  }
  if (bytes.length !== 32) throw failure("GOOGLE_CONFIGURATION_REQUIRED", 503);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(env, value, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(context),
      },
      await encryptionKey(env),
      new TextEncoder().encode(JSON.stringify(value)),
    );
  return JSON.stringify({ v: 1, iv: base64url(iv), cipher: base64url(cipher) });
}
export async function unseal(env, value, context) {
  try {
    const parsed = JSON.parse(value);
    if (parsed.v !== 1) throw Error();
    const iv = decode64(parsed.iv);
    if (iv.length !== 12) throw Error();
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(context),
      },
      await encryptionKey(env),
      decode64(parsed.cipher),
    );
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain));
  } catch {
    throw failure("GOOGLE_CREDENTIAL_CONTEXT_CHANGED", 401);
  }
}
export async function verifyGoogleIdentity(
  token,
  { clientId, nonce, createdAt, fetchJson, now = Date.now() },
) {
  if (typeof token !== "string" || token.length > 16384)
    throw failure("INVALID_GOOGLE_IDENTITY", 401);
  const parts = token.split(".");
  if (parts.length !== 3) throw failure("INVALID_GOOGLE_IDENTITY", 401);
  let header, claims;
  try {
    header = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(decode64(parts[0])),
    );
    claims = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(decode64(parts[1])),
    );
  } catch {
    throw failure("INVALID_GOOGLE_IDENTITY", 401);
  }
  if (
    !header ||
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.kid.length > 200 ||
    header.jku ||
    header.x5u
  )
    throw failure("INVALID_GOOGLE_IDENTITY", 401);
  const certs = await fetchJson("https://www.googleapis.com/oauth2/v3/certs");
  if (!Array.isArray(certs.keys) || certs.keys.length > 16)
    throw failure("GOOGLE_IDENTITY_KEYS_UNAVAILABLE", 502);
  const candidates = certs.keys.filter(
    (k) =>
      k.kid === header.kid &&
      k.kty === "RSA" &&
      (!k.alg || k.alg === "RS256") &&
      (!k.use || k.use === "sig") &&
      !k.d,
  );
  if (
    candidates.length !== 1 ||
    decode64(candidates[0].n).length < 256 ||
    decode64(candidates[0].n).length > 512 ||
    candidates[0]?.e !== "AQAB"
  )
    throw failure("INVALID_GOOGLE_IDENTITY", 401);
  let valid = false;
  try {
    const { n, e } = candidates[0],
      key = await crypto.subtle.importKey(
        "jwk",
        { kty: "RSA", n, e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode64(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    );
  } catch {
    throw failure("INVALID_GOOGLE_IDENTITY", 401);
  }
  const seconds = now / 1000,
    aud = claims?.aud;
  if (
    !valid ||
    !["https://accounts.google.com", "accounts.google.com"].includes(
      claims?.iss,
    ) ||
    !(
      aud === clientId ||
      (Array.isArray(aud) && aud.length <= 10 && aud.includes(clientId))
    ) ||
    (((Array.isArray(aud) && aud.length > 1) || claims.azp !== undefined) &&
      claims.azp !== clientId) ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.sub.length > 255 ||
    claims.nonce !== nonce ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= seconds ||
    claims.exp > seconds + 86400 ||
    !Number.isFinite(claims.iat) ||
    claims.iat > seconds + 60 ||
    claims.iat < createdAt / 1000 - 60
  )
    throw failure("INVALID_GOOGLE_IDENTITY", 401);
  return {
    issuer: "https://accounts.google.com",
    subject: claims.sub,
    name: typeof claims.name === "string" ? claims.name.slice(0, 100) : "",
  };
}
