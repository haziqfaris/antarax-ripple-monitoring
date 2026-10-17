// Staff accounts and sign-in (V-08). Passwords and two-step codes; sessions stored as hashes only.
import { plain } from "../db";
import { hashPassword, verifyPassword, DUMMY_HASH } from "../auth/password";
import { verifyTotp, newTotpSecret } from "../auth/totp";
import { seal, unseal } from "../seal";
import { randomString, sha256Hex } from "../../vendor/lapisan/crypto";
import type { Role } from "../auth/roles";
import type { StaffActor } from "./actor";

export const SESSION_HOURS = 12;
export const IDLE_MINUTES = 120;
const MAX_FAILS = 5, FAIL_WINDOW_MIN = 15;

export async function addStaff(email: string, name: string, role: Role, password: string): Promise<string> {
  const hash = await hashPassword(password);
  return plain(async (tx) => (await tx<{ id: string }[]>`insert into staff (email, name, role, password_hash) values (${email.trim().toLowerCase()}, ${name.trim()}, ${role}, ${hash}) returning id`)[0]!.id);
}

/** Step one: email and password. A fresh session that still needs its two-step code. */
export async function signIn(email: string, password: string): Promise<{ token: string; needsSetup: boolean } | { error: string }> {
  const e = email.trim().toLowerCase();
  return plain(async (tx) => {
    const n = (await tx<{ n: number }[]>`select count(*)::int as n from sign_in_attempts where email = ${e} and not ok and at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})`)[0]?.n ?? 0;
    if (n >= MAX_FAILS) return { error: `Too many attempts. Try again in ${FAIL_WINDOW_MIN} minutes.` };
    const [s] = await tx<{ id: string; password_hash: string; totp_secret_sealed: string | null; disabled_at: Date | null }[]>`select id, password_hash, totp_secret_sealed, disabled_at from staff where email = ${e}`;
    const ok = await verifyPassword(password, s?.password_hash ?? DUMMY_HASH);
    await tx`insert into sign_in_attempts (email, ok) values (${e}, ${!!(s && ok && !s.disabled_at)})`;
    if (!s || !ok || s.disabled_at) return { error: "That email and password don't match." };
    const token = randomString(40);
    await tx`insert into sessions (token_hash, staff_id, expires_at) values (${await sha256Hex(token)}, ${s.id}, now() + make_interval(hours => ${SESSION_HOURS}))`;
    return { token, needsSetup: !s.totp_secret_sealed };
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

/** Halfway: signed in with a password, two-step not done yet. */
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
