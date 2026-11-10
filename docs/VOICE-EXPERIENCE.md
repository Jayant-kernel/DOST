# Voice experience

Run `npm run dev` on localhost:3000, with the separately configured Evon/tokenizer services. Press **Start talking** once, allow microphone permission, and speak naturally. **Stop** ends the conversation, **Repeat reply** replays available speech, and **Change person** returns to identification. The browser reconnects listening after a reply while the session remains active.

The interface distinguishes checking, loading and offline model/tokenizer status. Reloading a web page does not restart an offline model service. Use the existing approved startup tools; do not start a second model. Prisma/Timbre calls need private server credentials and may consume provider credits. Browser tests use mocks and do not qualify physical microphones, acoustics or real barge-in.

The page supports explicit persona/pacing/preferences, readable English controls, zoom, keyboard controls and development diagnostics. Internal Saathi/Tara strings remain compatible with the existing APIs; the public project name is Dost. No current product quality or clinical suitability is implied by the UI.

`/voice-preview` is a separate development-only staff comparison page. Fifteen labelled WAV assets from five fictional scripts are bundled in `fixtures/voice/`; duplicate conditions deliberately share identical audio. Existing and neutral are identical for all scenarios. The expressive greeting is also identical. Do not count copies as new synthesized samples or participant preferences. A live fixed preview is explicit and separate from saved playback.
