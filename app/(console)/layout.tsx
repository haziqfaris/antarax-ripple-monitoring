import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor, sessionToken, clearSessionCookie } from "@/lib/auth/session";
import { signOut } from "@/lib/services/staff";
import { inScope } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { ShellFrame, type NavGroup } from "../_components/nav";

export const dynamic = "force-dynamic";

async function signOutAction(form: FormData) {
  "use server";
  const t = await sessionToken();
  if (t) await signOut(t, form.get("everywhere") === "1");
  await clearSessionCookie();
  redirect("/sign-in");
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const c = await inScope("all", async (tx) => (await tx<{ setting: number; waiting: number; failing: number; reports: number }[]>`select
    (select count(*)::int from applications where stage = 'set_up') as setting,
    (select count(*)::int from approvals where status = 'waiting') as waiting,
    (select count(*)::int from integrations i join applications a on a.id = i.application_id where a.stage in ('waiting', 'collecting') and i.state in ('late', 'not_answering')) as failing,
    (select count(*)::int from reports where status = 'waiting') as reports`)[0]!);
  const groups: NavGroup[] = [
    { title: "Track", items: [{ href: "/applications", label: "Applications", count: c.setting }, { href: "/approvals", label: "Approvals", count: c.waiting, loud: actor.role === "approver" }] },
    { title: "Report", items: [{ href: "/organisations", label: "Results" }, { href: "/reports", label: "Reports", count: c.reports, loud: actor.role === "approver" }] },
    { title: "Running it", items: [{ href: "/jobs", label: "Jobs", count: c.failing, loud: true }] },
  ];
  return (
    <ShellFrame groups={groups}
      side={<>
        <Link href="/applications" className="brand" style={{ textDecoration: "none" }}><span className="brand-mark" aria-hidden="true">A</span><span><b>AXLE</b><small>OUTCOMES</small></span></Link>
        {actor.role !== "viewer" ? <Link href="/applications/new" className="track-btn">+ Track an application</Link> : null}
      </>}
      foot={<div className="side-foot">
        <span><b>{actor.label}</b>{ROLE_LABEL[actor.role]}</span>
        <form action={signOutAction}><button type="submit" className="ghost-dark" style={{ width: "100%" }}>Sign out</button></form>
        <span>Authorised REKA staff · every action is recorded</span>
      </div>}>
      {children}
    </ShellFrame>
  );
}
