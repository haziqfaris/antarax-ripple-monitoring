import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { signIn, rateLimit, proposeSecret } from "@/lib/services/staff";
import { setSessionCookie, sessionToken } from "@/lib/auth/session";
import { actorFor } from "@/lib/services/staff";
import { seal } from "@/lib/seal";
import { Submit } from "../_components/controls";
import { Notice, sp } from "../_components/ui";

export const metadata = { title: "Sign in" };

async function signInAction(form: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!(await rateLimit(`sign-in:${ip}`, 30, 900))) redirect("/sign-in?e=" + encodeURIComponent("Too many attempts from here. Try again in 15 minutes."));
  const r = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if ("error" in r) redirect("/sign-in?e=" + encodeURIComponent(r.error));
  await setSessionCookie(r.token);
  if (r.needsSetup) (await cookies()).set("outcomes_totp_setup", await seal(proposeSecret()), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/sign-in", maxAge: 900 });
  redirect("/sign-in/two-step");
}

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await actorFor(await sessionToken())) redirect("/applications");
  const q = await searchParams;
  return (
    <main className="auth">
      <form action={signInAction} className="card form" aria-labelledby="h">
        <div><span className="axle-tag">AXLE</span></div>
        <h1 id="h">Sign in to AXLE · Outcomes</h1>
        <p className="muted small">For authorised REKA staff. Every action is recorded.</p>
        <Notice e={sp(q.e)} ok={sp(q.ok)} />
        <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="username" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required minLength={12} /></div>
        <Submit primary>Continue</Submit>
      </form>
    </main>
  );
}
