/**
 * The small Web Crypto helpers every part of Lapisan shares: HMAC-SHA256
 * and SHA-256 as hex, random characters without bias, a comparison in
 * constant time, and base64url. Only crypto.subtle, crypto.getRandomValues
 * and crypto.randomUUID, so the same code runs on Node, Cloudflare Workers
 * and Appwrite functions.
 */

const encoder = new TextEncoder();

/** No 0, O, 1, I or l, so a key read aloud or off a screen is not misread. */
export const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Random characters from the alphabet with no bias. A byte is used only when
 * it falls below the largest multiple of the alphabet's length (224 for 56
 * characters); taking every byte modulo 56 would make the first 32
 * characters more likely than the rest.
 */
export function randomString(length: number, alphabet = KEY_ALPHABET): string {
  const n = alphabet.length;
  const limit = 256 - (256 % n);
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b >= limit) continue;
      out += alphabet[b % n];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Hex characters from a random UUID, at most 32: the opaque part of ids like req_ and evt_. */
export function randomHex(length: number): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256 of a message with a key, as hex. */
export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", k, encoder.encode(message)));
}

/** SHA-256 of a string, as hex. */
export async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(message)));
}

/**
 * Compare two strings (hex digests, usually) in time that does not depend
 * on where they first differ. Unequal lengths answer false at once; the
 * length of a digest is no secret.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Text as base64url, without padding. */
export function toBase64Url(text: string): string {
  let binary = "";
  for (const b of encoder.encode(text)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64url (or base64) back to text. Throws when it is not base64. */
export function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
