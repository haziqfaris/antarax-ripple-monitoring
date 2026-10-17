// Staff accounts and sign-in (V-08). An e-mailed link, then a two-step code; links and sessions stored as hashes only.
import { plain } from "../db";
import { verifyTotp, newTotpSecret } from "../auth/totp";
import { seal, unseal } from "../seal";
import { randomString, sha256Hex } from "../../vendor/lapisan/crypto";
import type { Role } from "../auth/roles";
import type { StaffActor } from "./actor";

export const SESSION_HOURS = 12;
export const IDLE_MINUTES = 120;
export const LINK_MINUTES = 15;
const MAX_FAILS = 5, FAIL_WINDOW_MIN = 15;
const EXPIRED = "This sign-in link has expired or has already been used. Ask for a new one.";

const normal = (email: string) => email.trim().toLowerCase();

export async function addStaff(email: string, name: string, role: Role): Promise<string> {
  return plain(async (tx) => (await tx<{ id: string }[]>`insert into staff (email, name, role) values (${normal(email)}, ${name.trim()}, ${role}) returning id`)[0]!.id);
}

/** Step one: a link to e-mail. Only an active staff member gets one; the caller answers the same either way. */
export async function requestLink(email: string): Promise<{ token: string; name: string; email: string } | null> {
  const e = normal(email);
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(e)) return null;
  return plain(async (tx) => {
    await tx`delete from sign_in_links where expires_at < now() - interval '1 day'`;
    const [s] = await tx<{ id: string; name: string }[]>`select id, name from staff where email = ${e} and disabled_at is null`;
    if (!s) return null;
    const token = randomString(40);
    await tx`insert into sign_in_links (token_hash, staff_id, expires_at) values (${await sha256Hex(token)}, ${s.id}, now() + make_interval(mins => ${LINK_MINUTES}))`;
    return { token, name: s.name, email: e };
  });
}

/** Who a link is for, without using it: the link page asks first, so a mail scanner that opens it spends nothing. */
export async function linkFor(token: string | undefined): Promise<{ email: string } | null> {
  if (!token || token.length > 100) return null;
  const h = await sha256Hex(token);
  return plain(async (tx) => (await tx<{ email: string }[]>`select f.email from sign_in_links l join staff f on f.id = l.staff_id
    where l.token_hash = ${h} and l.used_at is null and l.expires_at > now() and f.disabled_at is null`)[0] ?? null);
}

/** Use a link, once: a fresh session that still needs its two-step code. */
export async function redeemLink(token: string): Promise<{ token: string; needsSetup: boolean } | { error: string }> {
  if (!token || token.length > 100) return { error: EXPIRED };
  const h = await sha256Hex(token);
  return plain(async (tx) => {
    const [r] = await tx<{ staff_id: string; totp_secret_sealed: string | null }[]>`update sign_in_links l set used_at = now() from staff f
      where l.token_hash = ${h} and l.used_at is null and l.expires_at > now() and f.id = l.staff_id and f.disabled_at is null
      returning l.staff_id, f.totp_secret_sealed`;
    if (!r) return { error: EXPIRED };
    const session = randomString(40);
    await tx`insert into sessions (token_hash, staff_id, expires_at) values (${await sha256Hex(session)}, ${r.staff_id}, now() + make_interval(hours => ${SESSION_HOURS}))`;
    return { token: session, needsSetup: !r.totp_secret_sealed };
  });
}

interface SessionRow { staff_id: string; two_step_done: boolean; email: string; name: string; role: Role; totp_secret_sealed: string | null }

async function sessionRow(token: string): Promise<SessionRow | null> {
  if (!token || token.length > 100) return null;
  const h = await sha256Hex(token);
  return plain(async (tx) => {
    const [r] = await tx<SessionRow[]>`select s.staff_id, s.two_step_done, f.email, f.name, f.role, f.totp_secret_sealed from sessions s join staff f on f.id = s.staff_id
      where s.token_hash = ${h} and s.expires_at > now() and s.last_seen_at > now() - make_interval(mins => ${IDLE_MINUTES}) and f.disabled_at is null`;
    if (r) await tx`update sessions set last_seen_at = now() where token_hash = ${h}`;
    return r ?? null;
  });
}

/** The signed-in person, only once their two-step code is done. */
export async function actorFor(token: string | undefined): Promise<StaffActor | null> {
  const r = token ? await sessionRow(token) : null;
  return r && r.two_step_done ? { id: r.staff_id, label: r.name, role: r.role, email: r.email } : null;
}

/** Halfway: signed in with a link, two-step not done yet. */
export async function pendingFor(token: string | undefined): Promise<{ email: string; hasSecret: boolean } | null> {
  const r = token ? await sessionRow(token) : null;
  return r && !r.two_step_done ? { email: r.email, hasSecret: !!r.totp_secret_sealed } : null;
}

/** The first time: a secret to add to an authenticator app. Kept sealed on the session's staff row only once confirmed. */
export const proposeSecret = newTotpSecret;

export async function completeTwoStep(token: string, code: string, newSecret?: string): Promise<{ ok: true } | { error: string }> {
  const h = await sha256Hex(token);
  return plain(async (tx) => {
    const [r] = await tx<{ staff_id: string; email: string; totp_secret_sealed: string | null }[]>`select s.staff_id, f.email, f.totp_secret_sealed from sessions s join staff f on f.id = s.staff_id where s.token_hash = ${h} and s.expires_at > now() and not s.two_step_done`;
    if (!r) return { error: "Sign in again." };
    const n = (await tx<{ n: number }[]>`select count(*)::int as n from sign_in_attempts where email = ${r.email} and not ok and at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})`)[0]?.n ?? 0;
    if (n >= MAX_FAILS) return { error: `Too many attempts. Try again in ${FAIL_WINDOW_MIN} minutes.` };
    const secret = r.totp_secret_sealed ? await unseal(r.totp_secret_sealed) : newSecret;
    if (!secret) return { error: "Set up two-step first." };
    const ok = await verifyTotp(secret, code);
    await tx`insert into sign_in_attempts (email, ok) values (${r.email}, ${ok})`;
    if (!ok) return { error: "That code didn't match. Use the newest one from your authenticator app." };
    if (!r.totp_secret_sealed) await tx`update staff set totp_secret_sealed = ${await seal(secret)} where id = ${r.staff_id}`;
    await tx`update sessions set two_step_done = true, last_seen_at = now() where token_hash = ${h}`;
    return { ok: true };
  });
}

export async function signOut(token: string, everywhere = false): Promise<void> {
  const h = await sha256Hex(token);
  await plain(async (tx) => {
    if (everywhere) await tx`delete from sessions where staff_id = (select staff_id from sessions where token_hash = ${h})`;
    else await tx`delete from sessions where token_hash = ${h}`;
  });
}

export async function staffNames(): Promise<Map<string, string>> {
  return plain(async (tx) => new Map((await tx<{ id: string; name: string }[]>`select id, name from staff`).map((r) => [r.id, r.name])));
}

export async function rateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  return plain(async (tx) => {
    const n = (await tx<{ n: number }[]>`select count(*)::int as n from rate_hits where bucket = ${bucket} and at > now() - make_interval(secs => ${windowSeconds})`)[0]?.n ?? 0;
    if (n >= max) return false;
    await tx`insert into rate_hits (bucket) values (${bucket})`;
    return true;
  });
}
