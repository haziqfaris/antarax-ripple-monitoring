# Outcomes console: first mock

A clickable mock of Performance Intelligence's staff console, built to the AXLE standard. Plain HTML, CSS and JavaScript; no build step and no libraries.

**Open it:** `index.html` in a browser, or `python3 -m http.server -d mocks` from the repository root.

**Every organisation, person and figure is invented.** The raw daily observations are generated from a fixed seed in `data.js`; every figure on screen is computed from them in `app.js`, the way the real compute service would work (PRD §8.5). So the portfolio, the organisation page, the solution page and the client report always agree.

## Screens

| Address | Screen | Try this |
|---|---|---|
| `#portfolio` | Portfolio | Change the range; hover the chart; switch staff (top right) to Aisyah Rahman to see commercial figures |
| `#organisation-contoh-logistik` | Organisation | "As the client sees it" hides commercial figures, notes and drafts; read how the total avoids double counting |
| `#solution-doc-workflow` | Solution | The impact breakdown (measured vs estimated, with range); switch Live, Stale, Failing, Not connected; open each tab |
| `#connect` | Connect a solution | Test the connection, validate metrics (one warning, one quarantined), let AI propose a plan, keep or reject, send for approval |
| `#approvals` | Approvals | As Daniel Lim, approve "Time to first response" with a reason; open his own baseline change and see why he can't approve it |
| `#report` | Client report | The light, reviewed PDF layout, with evidence, caveats and next steps |

Other navigation items open a placeholder that says what the screen will hold.

## Staff in the mock

| Person | Rung | Rights | Shows |
|---|---|---|---|
| Nurul Aina | Support | Measurement | Can propose; can't approve; can't see commercial figures |
| Daniel Lim (default) | Operator | Approve | Can approve, except his own proposals |
| Aisyah Rahman | Admin | Approve, Commercial | Sees contract value and run cost |

## Files

- `index.html`: the shell (sidebar, top bar, example-data banner)
- `styles.css`: AXLE tokens and components, the light report paper
- `data.js`: example organisations, solutions, observations, KPIs, approvals and audit
- `app.js`: routing, computation, charts and the interactive flows
- `assets/`: the AntaraX A, the AI sparkle and the REKA lockup, copied from the brand kit
