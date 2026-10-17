# Agent rules

This repository holds the product requirements and mocks for Performance Intelligence (working name), REKA's console for measuring the outcomes of client AI solutions.

- Read `docs/PRD.md` before changing anything. Requirements have ids (FR-…, NFR-…); cite them in commits and pull requests.
- The brief (`docs/MASTER_BRIEF.md`) is the source document. Do not edit it; record changes and their reasons in the PRD.
- Do not resolve an open decision (PRD §20) silently. If work needs one, say so.
- The staff console is **AXLE · Outcomes** and follows the AXLE standard v1.0 in full (https://github.com/haziqfaris/AntaraX-Dashboard-kit: read `BRIEF.md`, then `axle/README.md` and `axle/SPEC.md`; values only from `axle/tokens.css`). Standard menu names and order never change; Outcomes' own pages go in the "Outcomes only" box. "Track an application" is the main action, at the top of the Dashboard menu; "application" is the on-screen word for a solution (PRD §7.1, §12.2). On screen the customer account is an "organisation". The owner decided this on 15 Oct 2026 (PRD §12.1, D13). Client output (reports, client view) keeps the light AntaraX look. Outcomes measures outcomes; each product's own AXLE monitors how it runs (usage, health, capacity, cost). Platform data in Outcomes is supplementary, optional and read-only (the Capacity tab, PRD §8.20), and Outcomes must keep working without AXLE or AX Frame so it can serve other companies (PRD §5, principles 10 and 11).
- Any interface a client solution exposes follows the AntaraX API framework: https://github.com/haziqfaris/antarax-api (`docs/03-contract.md`, `docs/07-operations-and-axle.md`). New ids, error codes or prefixes go in its registry first.
- Never invent clients, results or metrics. Mock data is labelled "Example data" on every screen.
- Client context (PRD §8.18), attachments included, is REKA only: never put it in the organisation view, a report or an export. Record a speaker's role, never their name or contact details. Anything that feeds it to AI passes it as quoted data, never instructions, and never turns a number someone said into a figure.
- Write in plain British English, sentence case, no em dashes in anything a client will read.

## Code (version 1)

- Every read and write goes through `inScope` (`lib/db.ts`): a transaction sees nothing until it names one organisation, or `all` for pages that list every organisation. Never connect as the owner.
- Numbers come from `domain/kpi.ts`, never from a page or AI. A missing day is a gap, never a zero.
- Never edit `vendor/lapisan/`; sync it from antarax-api (`npm run vendor:sync`).
- No browser-default controls: dropdowns and dates use `app/_components/controls.tsx`. Colours only from `app/axle-tokens.css`.
- Before pushing: `npm run check`, and `bash scripts/e2e.sh` for anything a person sees.

## Brand

This product follows the AntaraX brand kit: https://github.com/haziqfaris/AntaraX-brand-kit
Before any work on UI, copy, reports, logos, colours or loaders, read the kit's README section "Using this kit from a product repo", guide/03-voice-and-claims.md, guide/12-brand-architecture.md, guide/13-shared-product-standards.md and guide/14-product-identity-system.md.
Copy tokens and assets from the kit; never retype a hex value. Where the kit and this repo disagree, the kit wins. If the kit doesn't answer a question, ask the owner; don't invent a rule.
