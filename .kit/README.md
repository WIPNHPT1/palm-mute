# Palm/Mute — Build Kit

Everything needed to hand this off to Claude Code and get a working, deployed prototype with minimum back-and-forth.

**Start here:** `BUILD-WALKTHROUGH.md` is a single, complete, plain-English, step-by-step guide from "never done this before" all the way to a deployed site — done entirely through the **Claude desktop app**, with no terminal, no local installs, and no command-line typing. The only manual steps are a couple of free sign-ups and some clicks on the GitHub and Netlify websites; everything technical is done by asking Claude, in plain English, to do it. The rest of this README is reference material that walkthrough points to as it goes.

Read in this order:

0. **`mockups/index.html`** — the visual source of truth: 9 flattened, standalone static HTML pages (no artifact runtime needed). `mockup-source/` has the original `.dc.html` design-tool files if you want to keep iterating on the visual design itself.
1. **`design-tokens.json`** — colors, type, spacing, radii, shadows, icons, breakpoints.
2. **`component-spec.md`** — every UI component, its states, and exactly how each page reflows at desktop/tablet/mobile. Every place the mockup used placeholder data instead of real logic is flagged **[LOGIC NEEDED]** and cross-referenced to the doc that resolves it.
3. **`data/*.json`** — the actual content engine: a musically-correct 12-key power chord library (computed, not copied from the mockup — see the note inside `chord-library.json` about one mislabeled chord in the original design), 6 chord progressions with a sort heuristic, rhythm patterns, the Fast-Punk/Half-Time/Mid-Tempo tempo architecture, section templates, and the song-title word bank.
4. **`data-model.md`** — the generation algorithm that turns Key + Feel + Progression into rendered tabs, including the originality-check approach (flagged as needing one confirmation from you — see §6).
5. **`interaction-spec.md`** — the state shape and every control's exact effect, including a few UX judgment calls (locking behavior across key changes, dark-mode scope) called out for you to confirm or leave at the recommended default.
6. **`tech-stack.md`** — the locked architecture decisions (Next.js static export, Tailwind wired to the tokens, Tone.js for audio, Netlify deploy) so Claude Code isn't making these mid-build.
7. **`repo-structure.md`** — the target file tree.
8. **`acceptance-criteria.md`** — the QA checklist Claude Code should self-verify against before calling it done.
9. Config files ready to drop straight into the repo: `netlify.toml`, `next.config.js`, `tailwind.config.js`, `package.json`, `.github/workflows/build-check.yml`.
10. **`claude-code-routine/`** — `CLAUDE.md` (project safety rules: feature-branch/PR only, no force-push, no skipped checks, no destructive git ops), `build-palm-mute.md` (a `/build-palm-mute` slash command that runs the full build end-to-end), and `settings.json` (the allow/deny list that actually makes it "auto mode" — pre-approves edits and safe commands, hard-blocks dangerous ones). Drop these into the repo per `BUILD-WALKTHROUGH.md` §4-6 to run the build in auto mode safely.
11. **`.gitignore`** — goes at the repo root (not under `.kit/`) so Git never commits `node_modules/`, build output, or stray editor files. See `BUILD-WALKTHROUGH.md` §4.

## Open decisions that need your one-word confirmation before/while building
These are called out in-line in the docs above, collected here for convenience:
- **Originality-check badge** (`data-model.md` §6): lightweight pattern-matching, or always-PASS for v1? *Recommended: always-PASS for v1.*
- **Locked sections across key changes** (`interaction-spec.md` §2): frozen forever once locked, or re-rendered on key change but protected from Generate/regenerate only? *Recommended: frozen once locked.*
- **Dark-mode toggle** (`interaction-spec.md` §2): build a real dark theme, or disable the control for v1? *Recommended: disable for v1.*
- **Audio approach** (`tech-stack.md`): sampled guitar/drum audio (needs a small licensed sample pack) vs. fully synthesized (no samples, simpler licensing, slightly less realistic sound)? *Recommended: synthesized for a cleaner prototype repo, unless realism matters more than repo simplicity to you.*
- **Chorus highlight** (`component-spec.md` §2): does the accent-highlighted Chorus card mean "chorus is always visually special," or should the highlight follow whichever section is most recently regenerated? *Recommended: always Chorus, matches every mockup.*

Answering these up front (or just telling Claude Code "go with the recommended defaults") is what gets you closest to true minimum-intervention — without them, Claude Code will have to guess or stop and ask mid-build.

## What you still need to do yourself (can't be automated from here)
- Create the empty GitHub repo (or grant access to an existing one) for Claude Code to push to.
- Create/connect the Netlify site to that repo — a one-time click in the Netlify dashboard ("Add new site → Import from Git"), since Netlify's GitHub App authorization is an account-level action only you can grant.
- If you go with sampled audio: source/license the small sample pack (or say the word and Claude Code can use synthesized audio instead and skip this entirely).

Everything else — repo scaffolding, all 9 pages/breakpoints, the data engine, styling, and the Netlify build config — is fully specified in this kit and buildable without further design input.
