# Phase 0 decisions

For the Performance Intelligence design workshop. Thirteen open questions from [PRD §20](../PRD.md#20-open-decisions), each with a recommendation, what is already built to back it, and what it blocks.

Calls are recorded on the shared workshop page and copied back here and into PRD §20 afterwards. Until then, every row is **open**.

## Decide before Phase 1

These block building. Phase 0 ends when they are signed.

### D9. First two pilots

**Question.** Which two REKA projects are the pilots, who owns each process, and is there baseline evidence for each?

**Recommendation.** One document automation and one workflow that is not about documents (brief §14). For each, name the client's process owner and record now whether a baseline exists: a timed sample, past records, a client estimate, or none.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Nothing yet. This one needs you to pick. | Everything in Phase 0: interviews, baselines and data agreements all hang off the two choices. | Now | Open |

### D3. Measurement interface

**Question.** Do REKA-built solutions expose Measurement Link at /internal/measure/v1, and do AntaraX products serve the same endpoints beside AXLE Link?

**Recommendation.** Yes to both, as written in antarax-api docs/14 and decision 0013.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Written and tested: the contract, a kit that serves it, a 17-check contract test, and the integration pack with examples (antarax-api packages/lapisan-core/src/measure; integrations/measure here). | The pilots' developers starting their integrations. | Now | Open |

### D4. Signing and keys

**Question.** Do calls use AXLE Link's HMAC signature with one ax_msr_ key per integration, a read-only bearer token only for a third party that cannot sign, and OAuth2 only when a client's IT requires it?

**Recommendation.** Yes. A key per integration means one leak never opens another client, and a key can rotate without a gap.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| In the kit and the contract test. A Python version matches the published test vectors. The key kind is proposed in the antarax-api registry. | The pilots' developers; how Outcomes stores and rotates keys. | Now | Open |

### D5. Data residency, retention and agreements

**Question.** Is client data kept in Singapore, on the retention periods in PRD §16, with a template data agreement signed before any collection?

**Recommendation.** Yes: Singapore, the §16 table (observations 25 months, reports and audit 7 years, AI prompts 90 days), and a template agreement drafted with legal before Phase 1.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Retention table drafted. The agreement template is not written yet. | Collecting anything: the product refuses to collect until an agreement is recorded as signed (FR-REG-2). | Now | Open |

### D12. Roles and rights

**Question.** Do roles follow the AXLE ladder (viewer to owner) plus three rights: Measurement, Approve and Commercial?

**Recommendation.** Yes. Nobody approves their own change, and only the Commercial right sees fees and running cost.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| The mock shows it with three people: an analyst who suggests, a project manager who approves, and an admin who sees fees. | Approvals, separation of duties and what each person sees. | Now | Open |

### D10. Grain and limits

**Question.** Daily figures; at most 200 metrics per solution, 5 dimensions per metric, 20 values per dimension, 92 days per read?

**Recommendation.** Yes. Hourly can come later as a minor version if a solution needs it.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Enforced by the kit and checked by the contract test. | Nothing, if agreed as written. Changing it later means a new version of the contract. | Now | Open |

### D11. Languages for the integration pack

**Question.** TypeScript first, Python second?

**Recommendation.** Yes: the TypeScript kit for most REKA solutions, and the Python signer for the rest. Others on request, from the test vectors.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Both exist and pass the same vectors. | A pilot not written in TypeScript. | Now | Open |

## Decide during Phase 1

Building can start without them. Each needs an answer before the stage named.

### D1. Name

**Question.** What is the product called, and how does it relate to Frame and AXLE?

**Recommendation.** "Outcomes" as an AXLE area for the MVP. The product name is chosen at graduation and recorded in the brand kit. "Ripple" stays a family name.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| The mock and PRD use "Outcomes" throughout. | Its address and the report credit line. | Before the first client report | Open |

### D2. Where it lives

**Question.** Its own host on the AXLE shell now, and a group in AXLE Central later?

**Recommendation.** Yes.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Stack proposal in PRD §15.2. | Hosting set-up. | Start of Phase 1 | Open |

### D6. Frame

**Question.** Is AntaraX Frame the source of truth for anything here?

**Recommendation.** Running cost only, REKA only, with the client's agreement. Health comes from the solution itself.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| The mock shows running cost to the Commercial right only. | Cost per item and the commercial summary. | Before commercial figures go live | Open |

### D7. Hosting and AI provider

**Question.** Vercel, Supabase in Singapore and the Anthropic API, with a cost review at the end of Phase 1?

**Recommendation.** Yes, as PRD §15.2. Review costs once pilot volumes are known.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Stack proposal written. | Budget after the pilots. | End of Phase 1 | Open |

### D8. Reports

**Question.** Format, branding and cadence of client reports?

**Recommendation.** Light AntaraX layout with "Run by REKA as part of Managed AI.", monthly for live solutions, a quarterly summary.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Report layout in the mock. | The first client report. | Before the first client report | Open |

### D16. Ask

**Question.** Which model, how long are questions kept, and do clients ever get Ask?

**Recommendation.** Current Claude model with tool calls; questions and answers logged 90 days; staff only in the MVP.

| Ready to back it | Blocks | Needed by | Call |
|---|---|---|---|
| Grounding rules in PRD §11.4; working in the mock. | Ask going live. | Before Ask goes live | Open |

## Already decided

| # | Decision | Outcome | When |
|---|---|---|---|
| D13 | Look | Outcomes is internal, so it follows the AXLE standard v1.0: dark bars, light page. Client reports keep the light AntaraX look | 15 Oct 2026, revised |
| D14 | AXLE standard | Settled by AXLE v1.0: every staff console is dark bars around a light page | 15 Oct 2026 |
| D15 | Value of time freed | RM45 an hour for every client, always shown as an estimate | 15 Oct 2026 |
| D17 | Demo studio | A product feature, in separate demo workspaces, core in the MVP | 15 Oct 2026 |
| D18 | Client or organisation | Settled by AXLE v1.0: "organisation" on screen, "member" for a client's person | 15 Oct 2026 |
