# Outcomes: clickable product mock

A clickable mock of Performance Intelligence (working name "Outcomes"): first sign-in, connecting a first project, measures, analytics, Ask, and demo workspaces with Demo studio for simulating new projects. Plain HTML, CSS and JavaScript. No build step, no libraries.

**Open it:** `index.html` in a browser, or `python3 -m http.server -d mocks` from the repository root.

**Every client, person and figure is invented.** Your workspace's figures are simulated from each project's kind of work, volume and baseline. The example workspace's figures come from a fixed seed in `data.js`. Every number on screen is worked out from those daily figures in `app.js`, so pages, Ask, analytics and reports always agree.

## Three workspaces

Switch in the sidebar (bottom) or the profile menu.

| Workspace | What it is |
|---|---|
| **Your workspace** (REKA Inisiatif) | Where first use happens: add a client, create a project, connect its solution. Dashed "Mock controls" bars move time on, because there is no real solution behind it |
| **Demo workspace** | A product feature (PRD §8.16): a separate workspace of simulated clients for sales demos, training and rehearsing reports. A banner says so on every screen; it never sends anything and never touches your real workspace. Demo studio lives here |
| **Example clients** | Five fixed example clients, labelled "Example data" |

## The quickest way in: the guided demo

Sign in, skip through welcome, and choose **Watch the guided demo**. It opens the demo workspace and plays 23 steps:

1. A new client is added, with a project.
2. The solution is connected: developer brief, live test, figure checks, AI-suggested KPIs, baseline.
3. The KPIs are approved, and the first figures arrive.
4. Five weeks pass, the data stops, then recovers.
5. The monthly report is drafted.
6. Three more clients are added.
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

| Where | What it shows |
|---|---|
| Home | First use: the seven-step checklist. Later: hours saved with likely range, what needs you (worked out from the data), and a card per client, those needing you first |
| **Clients** | Every client in one list: filter (all, need you, live, getting started), search clients or projects, sort (needs you first, most hours saved, biggest improvement, A to Z). Each row shows its projects with a status dot per solution, hours saved and value at RM45, change, 12-week trend, next report, fee (commercial right only) and renewal. The sidebar keeps your three most recent clients |
| A client | The same page in every workspace, with tabs: **Overview** (what needs you for this client, four figures with change, hours saved by project, the AI summary, projects table, contract and agreement), **Projects** (each project's outcome and its solutions), **Reports**, **Activity**. **Ask about** a client answers from that client's figures only. Team view and client view |
| Breadcrumbs | Clients › client › project › solution, on every solution and connection page |
| A solution, **Measures** tab | 13 standard measures in five areas (health, usage, operations, impact, commercial), with change and 12-week trend. **Add a measure** builds your own with a live preview and sends it for approval |
| **Analytics** | Any measure for all clients, one client or one solution, 30 days to 12 months: against the period before, by client or by solution, by weekday. Click a row to focus on it. Changes are only shown when the earlier period has enough data |
| **Ask** | Questions in plain words, for example "How is Contoh Logistik doing this month?", "How many hours did we save in October?", "Why did Invoice reader change this week?", "Which project improved most this month?", "Compare all projects", "Show the trend of work handled". Answers cite their projects and period; unrelated questions get an honest "I can only answer from the figures" |
| Approvals | KPIs and measures wait for someone other than the proposer. Switch to Aisyah Rahman in the profile menu to approve |
| Reports | Drafted on the 1st once a month of data is in; open one to see the client PDF layout |
| Profile menu | Switch person (rights change what you can do and see), light or dark, switch workspace |
| Settings | Team and rights, collection, RM45 an hour for value of time freed, demo workspace rules, audit trail |

## People in the mock

| Person | Can |
|---|---|
| Daniel Lim (you, by default) | Approve, except what he set up himself |
| Nurul Aina | Suggest KPIs and measures, not approve; no fees |
| Aisyah Rahman | Approve; sees running cost and fees |

## Files

- `index.html`: the page
- `styles.css`: the light AntaraX look, its dark mode, and the demo studio and tour styles
- `icons.js`: the brand kit's line icons plus a few interface glyphs
- `data.js`: the example workspace's clients, solutions, daily figures, KPIs, approvals and audit
- `app.js`: screens, routing, simulation, the measure library, analytics, Ask, demo studio and guided demo
- `assets/`: the AntaraX A, the AI sparkle, the REKA lockup and two BaTech pieces, copied from the brand kit
