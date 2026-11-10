# Core architecture

Development voice input → Prisma transcription → identity/consent/history controls → observation + shared planner + Conversation Director → verified prepared response or one Evon generation with existing bounded retry behavior → output validation/recovery → expression processing → Timbre speech.

The provider adapter uses the native model template and official numeric tokenizer when configured. Tara's policy is `persona_v2`; `legacy` and `full` remain internal selectable policies. Current source chooses Tara by default. Model settings are inherited from the existing implementation, not retuned for publication.

SQLite profile storage is local, owner-scoped and created only on explicit application use under ignored `.saathi-local/`. History opt-out and deletion are separate controls. Recall/preferences/context and pending confirmations follow the existing application paths. Stopping retention does not automatically erase old rows or external-provider data.

The development voice API supports session start, stop, interruption and streamed speech. A separate loopback Prisma gateway uses expiring single-use grants. The UI workstream is not imported. Profile state currently shares cart primitives; those modules are included as storage dependencies, without exposing a shopping route or real transactions.

Key modules: `src/lib/gnani/providers.ts`, `conversation-director.ts`, `conversation-planner.ts`, `persona.ts`, `reply-quality.ts`, `behaviour-validation.ts`, `reply-recovery.ts`, `history-retention.ts`, `voice-memory.ts`, `src/lib/shop/sqlite.ts`, and `src/app/api/voice/route.ts`.
