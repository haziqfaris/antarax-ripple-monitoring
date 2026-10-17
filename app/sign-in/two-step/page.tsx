import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { completeTwoStep, pendingFor, signOut } from "@/lib/services/staff";
import { sessionToken, clearSessionCookie } from "@/lib/auth/session";
import { otpauthUri } from "@/lib/auth/totp";
import { unseal } from "@/lib/seal";
import { Submit, CopyButton } from "../../_components/controls";
import { Notice, sp } from "../../_components/ui";

export const metadata = { title: "Two-step code" };

async function setupSecret(): Promise<string | null> {
  const c = (await cookies()).get("outcomes_totp_setup")?.value;
  if (!c) return null;
  try { return await unseal(c); } catch { return null; }
}

async function verifyAction(form: FormData) {
  "use server";
  const token = await sessionToken();
  if (!token) redirect("/sign-in");
  const r = await completeTwoStep(token, String(form.get("code") ?? ""), (await setupSecret()) ?? undefined);
  if ("error" in r) redirect("/sign-in/two-step?e=" + encodeURIComponent(r.error));
  (await cookies()).delete({ name: "outcomes_totp_setup", path: "/sign-in" });
  redirect("/applications");
}

async function cancelAction() {
  "use server";
  const t = await sessionToken();
  if (t) await signOut(t);
  await clearSessionCookie();
  redirect("/sign-in");
}

export default async function TwoStep({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const pending = await pendingFor(await sessionToken());
  if (!pending) redirect("/sign-in");
  const q = await searchParams;
  const secret = pending.hasSecret ? null : await setupSecret();
  return (
    <main className="auth">
      <div className="card form">
        <div><span className="axle-tag">AXLE</span></div>
        <h1>{secret ? "Set up your two-step code" : "Your two-step code"}</h1>
        <Notice e={sp(q.e)} />
        {secret ? (
          <div className="stack" style={{ gap: 10 }}>
            <p className="small">Add this key to your authenticator app (Google Authenticator, 1Password, Authy), then enter the six-digit code it shows.</p>
            <div className="code" role="region" aria-label="Your key" tabIndex={0} data-testid="totp-secret">{secret.match(/.{1,4}/g)!.join(" ")}</div>
            <div className="row"><CopyButton text={secret} label="Copy the key" /><CopyButton text={otpauthUri(secret, pending.email)} label="Copy the setup link" /></div>
          </div>
        ) : !pending.hasSecret ? <p className="small">Sign in again to set up your two-step code.</p> : <p className="small">Open your authenticator app and enter the six-digit code for AXLE Outcomes.</p>}
        <form action={verifyAction} className="form">
          <div className="field"><label htmlFor="code">Six-digit code</label><input className="input mono" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required /></div>
          <Submit primary>Continue</Submit>
        </form>
        <form action={cancelAction}><button className="btn ghost sm" type="submit">Cancel and sign out</button></form>
      </div>
    </main>
  );
}
