import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { linkFor, redeemLink, proposeSecret } from "@/lib/services/staff";
import { setSessionCookie } from "@/lib/auth/session";
import { seal } from "@/lib/seal";
import { Submit } from "../../_components/controls";
import { Notice, sp } from "../../_components/ui";

export const metadata = { title: "Sign in", referrer: "no-referrer" };

// Opening the link signs nobody in: a person presses Continue. Mail scanners that open links spend nothing.
async function continueAction(form: FormData) {
  "use server";
  const r = await redeemLink(String(form.get("t") ?? ""));
  if ("error" in r) redirect("/sign-in?e=" + encodeURIComponent(r.error));
  await setSessionCookie(r.token);
  if (r.needsSetup) (await cookies()).set("outcomes_totp_setup", await seal(proposeSecret()), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/sign-in", maxAge: 900 });
  redirect("/sign-in/two-step");
}

export default async function SignInLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = sp((await searchParams).t);
  const link = await linkFor(t);
  return (
    <main className="auth">
      <div className="card form">
        <div><span className="axle-tag">AXLE</span></div>
        {link ? (
          <form action={continueAction} className="form" aria-labelledby="h">
            <h1 id="h">Sign in as {link.email}</h1>
            <p className="small">Next, the code from your authenticator app.</p>
            <input type="hidden" name="t" value={t ?? ""} />
            <Submit primary>Continue</Submit>
          </form>
        ) : (
          <>
            <h1>This link can't be used</h1>
            <Notice e="It has expired or has already been used. Each link works once, for 15 minutes." />
            <Link className="btn primary" href="/sign-in">Ask for a new link</Link>
          </>
        )}
      </div>
    </main>
  );
}
