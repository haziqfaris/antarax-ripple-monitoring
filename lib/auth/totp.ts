// Two-step codes (RFC 6238): HMAC-SHA1, 6 digits, 30-second steps, one step either side for clock drift.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export async function totpAt(secret: string, unixSeconds: number): Promise<string> {
  const counter = Math.floor(unixSeconds / 30);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, counter);
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  const key = await crypto.subtle.importKey("raw", base32Decode(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = mac[mac.length - 1]! & 15;
  const n = ((mac[o]! & 127) << 24) | (mac[o + 1]! << 16) | (mac[o + 2]! << 8) | mac[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}

export async function verifyTotp(secret: string, code: string, unixSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  for (const d of [-30, 0, 30]) if ((await totpAt(secret, unixSeconds + d)) === c) return true;
  return false;
}

export const otpauthUri = (secret: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`AXLE Outcomes:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("AXLE Outcomes")}&algorithm=SHA1&digits=6&period=30`;
