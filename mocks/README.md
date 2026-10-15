# AXLE · Outcomes: clickable product mock

A clickable mock of Performance Intelligence (working name "Outcomes"), REKA's internal staff console, built on the **AXLE standard v1.0** ([AntaraX-Dashboard-kit](https://github.com/haziqfaris/AntaraX-Dashboard-kit): dark bars around a light page, the standard menu, an R8 mode). It covers first sign-in, connecting a first project, measures, analytics, Ask, and demo workspaces with Demo studio for simulating new projects. Plain HTML, CSS and JavaScript. No build step, no libraries.

**Open it:** `index.html` in a browser, or `python3 -m http.server -d mocks` from the repository root.

**Every organisation, person and figure is invented.** Your workspace's figures are simulated from each project's kind of work, volume and baseline. The example workspace's figures come from a fixed seed in `data.js`. Every number on screen is worked out from those daily figures in `app.js`, so pages, Ask, analytics and reports always agree.

## Three workspaces

Switch in the staff menu (your initials, top right) or Platform → Demo.

| Workspace | What it is |
|---|---|
| **Your workspace** (REKA Inisiatif) | Where first use happens: add an organisation, create a project, connect its solution. Dashed "Mock controls" bars move time on, because there is no real solution behind it |
| **Demo workspace** | A product feature (PRD §8.16): a separate workspace of simulated organisations for sales demos, training and rehearsing reports. A banner says so on every screen; it never sends anything and never touches your real workspace. Demo studio lives here |
| **Example data** | Five fixed example organisations, with a state banner on every page |

## The quickest way in: the guided demo

Sign in, skip through welcome, and choose **Watch the guided demo**. It opens the demo workspace and plays 23 steps:

1. A new organisation is added, with a project.
2. The solution is connected: developer brief, live test, figure checks, AI-suggested KPIs, baseline.
3. The KPIs are approved, and the first figures arrive.
4. Five weeks pass, the data stops, then recovers.
5. The monthly report is drafted.
6. Three more organisations are added.
7. Measures, your own measure, analytics and Ask.

Press **Next** on the dark card at the bottom left. You can also start it from Demo studio.

## Demo studio

In the demo workspace, the dashed **Demo studio** button in the top bar shows the simulated date. It opens a panel to:

- **name the demo workspace**, for example "Demo for Harapan Foods" before a sales call;
- **simulate a new project:** client, project, kind of work, daily volume, minutes by hand (0 means no baseline), history, and whether its KPIs are approved, waiting or not connected; or add three at once;
- **move the date:** +1 day, +1 week, +1 month, or play a day a second. Nightly collection, first data and report drafts on the 1st happen as they would for real;
- **cause something:** data stops arriving, stops answering, recovers (with or without filling the gap), volume spike, quality drop, or a new detail in its data (which goes to Approvals);
- **start over**, clearing only the demo workspace.

## What to look at

**Client data or managing.** The Outcomes-only box comes first and holds the client data; the AXLE standard groups below it are for managing Outcomes. Every Dashboard page carries a chip saying which it is: "Client data" or "Managing Outcomes".

**The shell** (AXLE SPEC §4, §6, §7). The top bar: the AntaraX A and the Outcomes chip, the orange `AXLE` tag, the page title, the organisation scope picker, Find (⌘K), the health button (opens R8; a red count when a measurement link fails), and the staff menu. The sidebar: the Dashboard · R8 switch, the AXLE STANDARD groups as folding cards (fold one to see its grey preview and orange roll-up), and the dashed **Outcomes only** box. Standard items this mock doesn't draw are listed in grey and aren't links.

| Mode | Where | What it shows |
|---|---|---|
| Dashboard: client data (Outcomes only, first) | **Results** (`#results`, `#results-…`) | Every organisation's figures and hours saved over time; then one organisation's figures, hours saved by project, the monthly summary, outcomes by project and reports, with staff view and organisation view |
| | **Reports**, **Approvals**, **Analytics**, **Ask** | Reports by organisation; separation of duties; any measure by organisation or solution; questions in plain words, including "What has Contoh told us?" |
| | **Client context** (`#context`, and a tab on each organisation's results) | What organisations told or gave BD and account managers, by role, never by name: a summary plus documents, photos (or the phone's camera), voice notes (recorded in the browser or uploaded) and links. The mock reads plain text files and hides personal details in them; other files are attached but not read. Each entry can be left out of AI; "Suggest measures from this" opens Explore with it. REKA only: hidden in organisation view, reports and exports |
| Dashboard: managing | **Overview** (`#home`) | First use: the checklist. Later: health strip, Needs a person (a technical problem opens Troubleshoot), Nightly collection, figures that open their lists, organisations by stage, organisations at a glance with readiness, hours saved, recent actions |
| | **Adoption** | People using each organisation's solutions, change, 12 weeks, and who stopped |
| | **Organisations** (`#organisations`) | Stats strip as filters, search, sort, group by stage or industry, export |
| | An organisation's account (`#organisation-…`) | Managing it: readiness and stage first; tabs Summary, Projects and solutions, Notes (REKA only), Audit; a link to its results |
| | A solution | **Measures** (13 standard measures; add your own) and **Explore**: re-prompt and explore other measures of business impact, ranked with the organisation's client context and quoting it |
| | **Demo**, **Settings**, **Audit**, **Staff** | Demo workspaces; platform switches that ask for a reason and raise the state banner; the audit; the ladder with "Needs Admin" |
| R8 | **Overview** (`#r8`) | One word for the platform, the build, Needs an operator, services, Outcomes' machinery, incidents, cost per organisation (Commercial right only), recent operations |
| | **Troubleshoot** (`#troubleshoot-quote-drafter` in example data) | Evidence in layers, timeline, AXLE's reading kept apart from your conclusion, Level 1 actions that ask for a reason |
| | **Incidents**, **Jobs**, **Providers**, **Services**, **Configuration**, **Operations audit** | Acknowledge; run now, retry failures, pause; test a provider; set or missing, never values; every R8 action with who and why |
| | Outcomes only: **Measurement links** | Each organisation's link: state, last good collection, nightly contract test, key age |

Switch person in the staff menu to see the ladder: Nurul Aina (Support) can acknowledge but not run Level 1 actions, Daniel Lim (Operator) can, Aisyah Rahman (Admin, with the Commercial right) also sees cost and can rotate keys.

The 0.5 addresses (`#clients`, `#client-…`, `#new-client`) and `#org-…` redirect to the organisation addresses.

## People in the mock

| Person | Can |
|---|---|
| Daniel Lim (you, by default) | Operator. Approve, except what he set up himself; Level 1 R8 actions |
| Nurul Aina | Support. Suggest KPIs and measures, not approve; acknowledge incidents; no fees |
| Aisyah Rahman | Admin. Approve; sees running cost and fees; staff and key rotation |
| Siti Mariam | Support. An account manager: adds client context and lets AI use it; no approvals, no fees |

## Files

- `index.html`: the page
- `styles.css`: the AXLE look, with the kit's `axle/tokens.css` values at the top, plus the demo studio and tour styles
- `icons.js`: the brand kit's line icons plus a few interface glyphs
- `data.js`: the example workspace's organisations, solutions, daily figures, KPIs, approvals and audit
- `app.js`: screens, routing, simulation, the measure library, analytics, Ask, demo studio and guided demo
- `assets/`: the AntaraX A, the AI sparkle, the REKA lockup and two BaTech pieces, copied from the brand kit
