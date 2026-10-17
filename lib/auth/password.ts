// PBKDF2-SHA256 with 600,000 iterations and a 16-byte salt (OWASP 2023), Web Crypto only.
const ITERATIONS = 600_000;
const enc = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, 256));
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("A password needs at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${Buffer.from(salt).toString("base64url")}$${Buffer.from(hash).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, iter, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
  const got = await derive(password, Buffer.from(salt, "base64url"), Number(iter));
  const want = Buffer.from(hash, "base64url");
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}

/** Spend the same time on an unknown email as on a wrong password. */
export const DUMMY_HASH = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
