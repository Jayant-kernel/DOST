# Synthetic conversation evaluation

Run `npm run test:conversation-eval` for deterministic fixture, scoring and transport checks. The source fixtures are entirely fictional. Automated scores do not substitute for independent Hindi-speaking human review.

From the repository root:

```sh
node scripts/evaluate-conversation-intelligence.mjs --mode routing --policy persona_v2 --output tasks/routing.json
node scripts/evaluate-conversation-intelligence.mjs --mode live --policy persona_v2 --output tasks/live.json
```

Choose a new output file; the recorder refuses accidental overwrite. Live mode needs the existing local Evon/tokenizer services and records synthetic prompts/raw answers. Output stays ignored. Never run it with private user conversations. Do not introduce paid reference inference or credentials; `reference.mjs` is inert until an explicitly authorized adapter is supplied.

`scripts/elder-eval.mjs` accepts `--run --output=tasks/new-cohort` and `--verify --output=tasks/new-cohort`. Supply a fictional sealed `personas.json` matching the evaluator schema before running. The exposed ten-person development fixture is bundled at `tests/fixtures/elders.json`: copy it to the output directory as `personas.json` for a development replay. Create unseen cohorts separately; the bundled cases are not a blind holdout. `node scripts/elder-eval.mjs --self-test` checks the player seam and bundled fixture without model requests. Historical generated replies and ratings are not shipped. It runs conversations serially and refuses fixture/source mismatches. Freeze source while measuring. Time excludes STT/TTS/playback; no human rating should be invented.
