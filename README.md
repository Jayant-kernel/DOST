# Dost

Hindi/Hinglish voice-companion backend for a development prototype. This repository publishes the core engineering workstream: conversation planning, Tara persona, local Evon integration, Prisma/Timbre adapters, owner-scoped profile storage, privacy controls and synthetic evaluation. Internal Saathi identifiers remain for compatibility.

The browser conversation and development listening-study interfaces are included by the B experience workstream. The demo film, production deployment and real-user datasets remain outside this publication. This is an experimental development prototype, not a production release.

## Setup

Requires Node.js 24+, npm and separately configured local model services.

```sh
npm ci --ignore-scripts
npm --prefix bridge ci --ignore-scripts
npm run typecheck
npm test
npm run build
```

Copy `.env.example` to `.env.local` and configure private server credentials locally. Never upload that file. Run `npm run dev` and open http://localhost:3000 for the conversation interface; `/voice-preview` provides saved comparisons and `/voice-preview?study=1` the listening pilot. The voice/profile routes intentionally reject production or invalid same-origin requests.

Evon must already be available on 127.0.0.1:8080 and the official-token input helper on 8081. The Windows launch scripts require an existing approved llama.cpp installation and matching local model file. No weights, executables, credentials or recordings are included. `start-evon-tokenizer.py` fetches the pinned public tokenizer on explicit execution if missing; Python's `tokenizers` package is required. Do not start a second model copy. Calls to Prisma/Timbre require configured provider access and may consume credits; tests use synthetic/mocked transports.

## Evaluation

```sh
node scripts/evaluate-conversation-intelligence.mjs --mode routing --policy persona_v2 --output tasks/routing.json
```

Routing mode does not establish model quality. Live mode explicitly invokes the local model. Generated reports stay under ignored `tasks/`. The standalone elder runner requires an authored fictional `personas.json` in its output directory; no historical reports or real profiles are bundled.

See [architecture](docs/ARCHITECTURE.md), [quality limits](docs/QUALITY.md), [contribution guide](docs/CONTRIBUTING.md) and [publication scope](docs/PUBLICATION.md). Core safety and natural conversation remain experimental; software tests are not human evaluation or clinical validation.

## Browser and listening experience

See [voice controls](docs/VOICE-EXPERIENCE.md), [listening protocol](docs/LISTENING-STUDY.md) and [B publication scope](docs/B-PUBLICATION.md). Bundled audio is fixed synthetic material; no human ratings are included. Live recognition/synthesis needs configured credentials and can consume credits. `npm run test:voice-analysis` tests the export analyzer with fabricated test fixtures only.
