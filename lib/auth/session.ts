import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { actorFor, pendingFor, SESSION_HOURS } from "../services/staff";
import { atLeast, type Role } from "./roles";
import type { StaffActor } from "../services/actor";

export const SESSION_COOKIE = "outcomes_session";
const secure = () => process.env.NODE_ENV === "production" || (process.env.APP_URL ?? "").startsWith("https://");

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
}
export async function clearSessionCookie(): Promise<void> { (await cookies()).delete(SESSION_COOKIE); }
export async function sessionToken(): Promise<string | undefined> { return (await cookies()).get(SESSION_COOKIE)?.value; }

/** The signed-in staff member, or a redirect to sign in. With a role, a redirect when they don't have it. */
export async function requireActor(role?: Role): Promise<StaffActor> {
  const a = await actorFor(await sessionToken());
  if (!a) {
    const pending = await pendingFor(await sessionToken());
    redirect(pending ? "/sign-in/two-step" : "/sign-in");
  }
  if (role && !atLeast(a.role, role)) redirect("/applications?e=" + encodeURIComponent(`Needs the ${role} role`));
  return a;
}

/** Server actions are same-origin only: Next checks Origin against Host; this repeats it for route handlers. */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === h.get("host"); } catch { return false; }
}

/** A value shown once (a new key, a developer link), kept sealed in a short-lived cookie, read once. */
const ONCE = "outcomes_once";
export async function setOnce(value: unknown): Promise<void> {
  const { seal } = await import("../seal");
  (await cookies()).set(ONCE, await seal(JSON.stringify(value)), { httpOnly: true, secure: secure(), sameSite: "strict", path: "/", maxAge: 300 });
}
export async function readOnce<T>(): Promise<T | null> {
  const c = (await cookies()).get(ONCE)?.value;
  if (!c) return null;
  try { const { unseal } = await import("../seal"); return JSON.parse(await unseal(c)) as T; } catch { return null; }
}
