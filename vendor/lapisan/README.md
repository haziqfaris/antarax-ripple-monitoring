# Vendored Lapisan code

A tagged copy of `@lapisan/core`'s Measurement Link kit, as antarax-api AGENTS rules 4 and 15 require: never edit it here.

| | |
|---|---|
| Source | `haziqfaris/antarax-api`, `packages/lapisan-core/src/measure/` and `src/crypto.ts` |
| Commit | `1418a09`, tagged `v0.9.0` (Measurement Link 1.1.0; the files are unchanged since `c7213de`) |
| Update | `npm run vendor:sync -- ../antarax-api` copies the files again; then record the new commit here |

Outcomes uses it as the caller: `signMeasureCall` for every request, `checkManifest`, `checkObservation`, `checkHealth` and `checkCapacity` on every answer, `checkMeasureLink` for the connection test. Tests and the end-to-end run serve `exampleAdapter` through `measureLink` as a stand-in application.
