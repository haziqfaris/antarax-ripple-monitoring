import Link from "next/link";
import { requireActor, setOnce } from "@/lib/auth/session";
import { listOrganisations, createOrganisation } from "@/lib/services/organisations";
import { createApplication } from "@/lib/services/applications";
import { act, str } from "@/lib/act";
import { Refused } from "@/lib/services/actor";
import { SelectField, Submit } from "../../../_components/controls";
import { Notice, PageHead, sp } from "../../../_components/ui";

export const metadata = { title: "Track an application" };

const INDUSTRIES = ["Logistics", "Manufacturing", "Healthcare", "Food and beverage", "Property and real estate", "Engineering and construction", "Financial services", "Retail", "Education", "Public sector", "Professional services", "Other"];
const ZONES = [["Asia/Kuala_Lumpur", "Kuala Lumpur (MYT)"], ["Asia/Singapore", "Singapore (SGT)"], ["Asia/Jakarta", "Jakarta (WIB)"], ["Asia/Bangkok", "Bangkok (ICT)"]] as const;

async function addOrg(form: FormData) {
  "use server";
  const actor = await requireActor("operator");
  await act("/applications/new", async () => {
    if (str(form, "name").length < 2) throw new Refused("Give the organisation's name.");
    const id = await createOrganisation(actor, { name: str(form, "name"), short: str(form, "short"), industry: str(form, "industry"), timeZone: str(form, "tz") || "Asia/Kuala_Lumpur", agreement: form.get("agreement") === "on" });
    return { to: `/applications/new?org=${id}`, ok: "Organisation added. Now the application." };
  });
}

async function addApp(form: FormData) {
  "use server";
  const actor = await requireActor("operator");
  const back = `/applications/new${str(form, "org") ? `?org=${str(form, "org")}` : ""}`;
  await act(back, async () => {
    if (!str(form, "org")) throw new Refused("Choose the organisation.");
    if (str(form, "name").length < 2 || str(form, "project").length < 2) throw new Refused("Give the application's name and its project.");
    if (!/^[a-z][a-z \-]{1,30}$/i.test(str(form, "unit"))) throw new Refused("The unit of work is one word or two, like claim or delivery order.");
    const source = str(form, "source") === "sheet" ? "sheet" : "link";
    const r = await createApplication(actor, { orgId: str(form, "org"), name: str(form, "name"), project: str(form, "project"), objective: str(form, "objective"), unit: str(form, "unit"), source });
    if (source === "link") await setOnce({ appId: r.appId, key: r.key, devToken: r.devToken });
    return `/applications/${r.appId}`;
  });
}

export default async function NewApplication({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActor("operator");
  const q = await searchParams;
  const orgs = await listOrganisations();
  const chosen = sp(q.org) && orgs.some((o) => o.id === sp(q.org)) ? sp(q.org)! : null;
  return (
    <>
      <PageHead title="Track an application" crumbs={<><Link href="/applications">Applications</Link><span>›</span><span>New</span></>}
        lead="Four steps: the organisation and the application here; then connect it, choose its figures, its KPIs and the baseline. Someone else approves before anything counts." />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      <div className="grid2" style={{ alignItems: "start" }}>
        <form action={addApp} className="card form" aria-labelledby="app-h">
          <h2 id="app-h">The application</h2>
          <p className="sub">Why: everything is reported per organisation, and the unit of work is what every KPI counts.</p>
          {orgs.length ? <SelectField name="org" label="Organisation" options={orgs.map((o) => ({ id: o.id, label: o.short_name }))} defaultValue={chosen} placeholder="Choose the organisation" required />
            : <p className="callout">Add the organisation first, on the right.</p>}
          <div className="field"><label htmlFor="name">Application name</label><input className="input" id="name" name="name" required maxLength={120} placeholder="For example: Claim reader" /></div>
          <div className="field"><label htmlFor="project">Project</label><input className="input" id="project" name="project" required maxLength={160} placeholder="For example: Claims automation" /></div>
          <div className="field"><label htmlFor="unit">One piece of its work is a…</label><input className="input" id="unit" name="unit" required maxLength={30} placeholder="claim" /><span className="hint">In the organisation's own word. Every KPI counts it: "Claims handled".</span></div>
          <div className="field"><label htmlFor="objective">What it is for, optional</label><textarea className="input" id="objective" name="objective" maxLength={400} placeholder="Free the claims team from typing claim forms, and reply to customers faster." /></div>
          <SelectField name="source" label="How it shares its figures" defaultValue="link" options={[{ id: "link", label: "Its own Measurement Link (a developer adds it)" }, { id: "sheet", label: "A spreadsheet, uploaded each month (no developer needed)" }]} />
          <Submit primary disabled={!orgs.length}>Start tracking</Submit>
        </form>
        <form action={addOrg} className="card form" aria-labelledby="org-h">
          <h2 id="org-h">Or add an organisation</h2>
          <p className="sub">Nothing is collected for an organisation until its data agreement is signed.</p>
          <div className="field"><label htmlFor="oname">Name</label><input className="input" id="oname" name="name" required maxLength={160} placeholder="Harapan Foods Sdn Bhd" /></div>
          <div className="field"><label htmlFor="short">Short name</label><input className="input" id="short" name="short" maxLength={60} placeholder="Harapan Foods" /></div>
          <SelectField name="industry" label="Industry" options={INDUSTRIES.map((i) => ({ id: i, label: i }))} defaultValue="Other" />
          <SelectField name="tz" label="Time zone its days are counted in" options={ZONES.map(([id, label]) => ({ id, label }))} defaultValue="Asia/Kuala_Lumpur" />
          <label className="check"><input type="checkbox" name="agreement" required /><span>The organisation's data agreement is signed: what is collected, why, where it is kept, and who gets reports.</span></label>
          <Submit>Add the organisation</Submit>
        </form>
      </div>
    </>
  );
}
