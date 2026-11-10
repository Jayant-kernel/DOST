# Contribution workflow

Keep core changes scoped, with tests at affected interfaces. Run `npm run typecheck`, `npm test` and `npm run build` before publication. Tests use fictional data; do not add real transcripts, profiles, audio or credentials.

Use current dates and actual author identity. Commit related implementation and tests together. The initial import commits group an existing codebase by responsibility; they do not reconstruct historical development dates or prove individual authorship percentages.

Do not weaken validators to reduce recovery counts. Model/runtime changes, external paid inference and deployments need separate explicit authorization. Preserve owner isolation, consent, retention controls and cancellation semantics.
