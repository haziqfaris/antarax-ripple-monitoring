import { env } from "./env";

/**
 * AES-256-GCM with SEAL_KEY, Web Crypto only. Measurement keys must be kept as themselves (both sides make
 * the same HMAC), so they are sealed, never hashed, and opened only to sign a call or show once.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey("raw", Buffer.from(env().SEAL_KEY, "base64"), "AES-GCM", false, ["encrypt", "decrypt"]);
  return keyPromise;
}

export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(plain)));
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(ct).toString("base64url")}`;
}

export async function unseal(sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Not a sealed value.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64url") }, await key(), Buffer.from(ct, "base64url"));
  return dec.decode(plain);
}

export function resetSeal(): void { keyPromise = null; }
