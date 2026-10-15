# Outcomes: clickable product mock

A clickable mock of Performance Intelligence (working name "Outcomes"), from first sign-in to a measured project, plus an established workspace with example clients. Plain HTML, CSS and JavaScript. No build step, no libraries.

**Open it:** `index.html` in a browser, or `python3 -m http.server -d mocks` from the repository root.

**Every organisation, person and figure is invented.** The example workspace says "Example data" in the top bar. Its daily figures are generated from a fixed seed in `data.js`, and every number on screen is worked out from them in `app.js`, so the home page, organisation, solution and client report always agree. In the first-use journey, the figures for your new solution come from the baseline you type in the connect flow.

## Journey 1: first use

1. **Sign in** with the REKA account button.
2. **Welcome:** name the workspace, invite the team (or skip), then choose **Connect my first project**.
3. **Home** shows a seven-step getting-started checklist. Follow its buttons:
   - **Add organisation:** the client and their signed data agreement.
   - **Create project:** pick the kind of work and write the outcome in the client's words.
   - **Connect solution:** eight guided steps. Copy the developer brief, tick that the link is in, run the live connection test, review what the solution shares (one figure is held back for privacy), keep or drop the AI-suggested KPIs, record the baseline, send for approval.
4. On the **solution page**, use the dashed "Mock controls" bar to move time forward: Aisyah approves, then the first nightly collection runs. Or switch to Aisyah Rahman from the profile menu and approve the KPIs yourself in **Approvals**.
5. **Schedule the report.** The checklist on Home completes.

## Journey 2: an established workspace

From the profile menu choose **Open the example workspace** (or pick "Explore with example data" at welcome).

| Address | Screen | Try this |
|---|---|---|
| `#home` | Home | Change the range; hover the chart; open a project card |
| `#organisations` | Organisations | Switch to Aisyah Rahman to see fees |
| `#organisation-contoh-logistik` | Organisation | Team view and client view; how totals avoid double counting; approve the AI summary |
| `#solution-doc-workflow` | Solution | Where the time goes; the four tabs; the mock control for late and not-answering data |
| `#approvals` | Approvals | As Daniel, approve "Time to first response" with a reason; open his own baseline change and see why he can't |
| `#report` | Client report | The reviewed PDF layout |

## People in the mock

| Person | Can |
|---|---|
| Daniel Lim (you, by default) | Approve, except what he set up himself |
| Nurul Aina | Suggest KPIs, not approve; no fees |
| Aisyah Rahman | Approve; sees fees |

Light, dark or system appearance is in the profile menu.

## Files

- `index.html`: the page
- `styles.css`: the light AntaraX look and its dark mode
- `icons.js`: the brand kit's line icons plus a few interface glyphs
- `data.js`: example organisations, solutions, daily figures, KPIs, approvals and audit
- `app.js`: screens, routing, calculations, charts and both journeys
- `assets/`: the AntaraX A, the AI sparkle, the REKA lockup and two BaTech pieces, copied from the brand kit
