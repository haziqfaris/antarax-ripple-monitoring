# Agent rules

This repository holds the product requirements and mocks for Performance Intelligence (working name), REKA's console for measuring the outcomes of client AI solutions.

- Read `docs/PRD.md` before changing anything. Requirements have ids (FR-…, NFR-…); cite them in commits and pull requests.
- The brief (`docs/MASTER_BRIEF.md`) is the source document. Do not edit it; record changes and their reasons in the PRD.
- Do not resolve an open decision (PRD §20) silently. If work needs one, say so.
- Staff screens follow the AXLE standard's rules (`axle/SPEC.md` in https://github.com/haziqfaris/AntaraX-Dashboard-kit: attention first, "never a false zero", a reason and a trail for every change) but use the light AntaraX product look, with dark mode optional. See PRD §12.1 and open decision D13.
- Any interface a client solution exposes follows the AntaraX API framework: https://github.com/haziqfaris/antarax-api (`docs/03-contract.md`, `docs/07-operations-and-axle.md`). New ids, error codes or prefixes go in its registry first.
- Never invent clients, results or metrics. Mock data is labelled "Example data" on every screen.
- Write in plain British English, sentence case, no em dashes in anything a client will read.

## Brand

This product follows the AntaraX brand kit: https://github.com/haziqfaris/AntaraX-brand-kit
Before any work on UI, copy, reports, logos, colours or loaders, read the kit's README section "Using this kit from a product repo", guide/03-voice-and-claims.md, guide/12-brand-architecture.md, guide/13-shared-product-standards.md and guide/14-product-identity-system.md.
Copy tokens and assets from the kit; never retype a hex value. Where the kit and this repo disagree, the kit wins. If the kit doesn't answer a question, ask the owner; don't invent a rule.
