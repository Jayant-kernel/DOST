# Listening study

Open `/voice-preview?study=1` in development. The interface asks adult/Hindi eligibility and informed consent, assigns opaque recording labels and randomized order, then collects six 1–5 ratings, optional anonymous feedback, scenario/overall preferences and concern reports. Listeners may stop or withdraw. Exported JSON stays on their device until they choose to share it. Do not upload real listener exports to GitHub.

Saved playback uses the bundled fixed fictional assets, with no extra TTS calls. The server rejects unknown selectors and requires all delivered recordings to be rated before export. Technical-check sessions cannot be counted as human ratings. Delivery and self-reported listening do not prove audible playback, independent identity or consent capacity.

No real ratings are included. Organizer verification of unique consenting eligible listeners is required. Run `node scripts/analyze-voice-study.mjs --verified verification.json --out NEW-results.json listener.json` only on voluntarily shared, separately reviewed exports. Keep all such inputs and outputs under ignored `tasks/` locally. The existing analyzer distinguishes technical/unverified records, ties and uncertainty; software tests use artificial fixtures, never actual participants.

Important current limitation: identical-condition audio must be excluded from comparative preference conclusions. The current analysis logic does not establish a fully hash-based exclusion for every possible comparison; check `fixtures/voice/manifest.json`, exclude identical pairs during review and report those exclusions explicitly. Do not interpret a numeric pilot PASS as production promotion. Await genuine Hindi listening evidence, including older adults where appropriate and with informed consent.

Provisional targets are naturalness, pronunciation and comfort at least 4/5, expressive preference at least 70% among eligible distinct-recording preference comparisons, and no critical speech-content regressions. Report sample sizes and uncertainty. These targets do not establish clinical or dementia-specific suitability.
