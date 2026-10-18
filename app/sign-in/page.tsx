import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestLink, rateLimit, actorFor, LINK_MINUTES } from "@/lib/services/staff";
import { sendSignInLink } from "@/lib/services/mail";
import { sessionToken } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { Submit } from "../_components/controls";
import { Notice, sp } from "../_components/ui";

export const metadata = { title: "Sign in" };

const SENT = `If that address belongs to a staff account, a sign-in link is on its way. It works once, for ${LINK_MINUTES} minutes.`;

async function sendLinkAction(form: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!(await rateLimit(`sign-in:${ip}`, 30, 900))) redirect("/sign-in?e=" + encodeURIComponent("Too many attempts from here. Try again in 15 minutes."));
  // The same answer whether or not the address has an account, and whether or not this address asked too often.
  if (await rateLimit(`sign-in-link:${email}`, 5, 900)) {
    const link = await requestLink(email);
    if (link) {
      const url = `${env().APP_URL.replace(/\/+$/, "")}/sign-in/link?t=${link.token}`;
      try {
        await sendSignInLink({ to: link.email, name: link.name, link: url, expiresAt: link.expiresAt, minutes: LINK_MINUTES });
      } catch (err) {
        console.error("sign-in e-mail not sent:", err instanceof Error ? err.message : "failed");
      }
    }
  }
  redirect("/sign-in?ok=" + encodeURIComponent(SENT));
}

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await actorFor(await sessionToken())) redirect("/applications");
  const q = await searchParams;
  return (
    <main className="auth">
      <form action={sendLinkAction} className="card form" aria-labelledby="h">
        <div><span className="axle-tag">AXLE</span></div>
        <h1 id="h">Sign in to AXLE · Outcomes</h1>
        <p className="muted small">For authorised REKA staff. We e-mail you a link, then ask for the code from your authenticator app. Every action is recorded.</p>
        <Notice e={sp(q.e)} ok={sp(q.ok)} />
        <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
        <Submit primary>Email me a sign-in link</Submit>
      </form>
    </main>
  );
}
