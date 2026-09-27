---
description: Build (or rebuild) the Palm/Mute prototype end-to-end from the .kit/ spec, safely, and open a PR.
---

You are building the Palm/Mute app in this repository. Follow `CLAUDE.md`'s safety rules at all times — feature branch only, no force-push, no skipped checks, no destructive git operations, self-check before declaring done.

## Steps

1. **Orient.** Read `.kit/README.md`, then `.kit/repo-structure.md` and `.kit/tech-stack.md`. If `DECISIONS.md` exists at the repo root, use those answers for the 5 open decisions; otherwise use the recommended defaults from `.kit/README.md` and note in the PR description that defaults were used.

2. **Branch.** Create and switch to `feature/build-prototype` (or `feature/build-prototype-2`, etc. if it already exists from a prior run). Never work on `main`.

3. **Scaffold**, if not already present:
   - Next.js app with static export (`output: "export"` in `next.config.js` — use the one provided in `.kit/` rather than generating your own).
   - Tailwind CSS, wired via the provided `.kit/tailwind.config.js`.
   - Copy `.kit/data/*.json` into `data/` in the app.
   - Copy `.kit/netlify.toml`, `.kit/package.json` (merge sensibly if one already exists rather than overwriting), and `.kit/.github/workflows/build-check.yml` into place.

4. **Build the data layer** (`lib/musicTheory.ts`, `lib/generator.ts`, `lib/originalityCheck.ts`) per `.kit/data-model.md`. These should be plain functions, no React dependency, so they're independently testable. Verify the Solo lead-lick formula produces `5,7,5,7` for Key of A before moving on — this is the one piece of logic explicitly called out as needing to be *computed*, not copied from the mockup.

5. **Build components** per `.kit/component-spec.md`, checking each against the matching mockup in `mockups/` at all three breakpoints (desktop/tablet/mobile) as you go — don't leave visual QA until the end.

6. **Wire state** per `.kit/interaction-spec.md` (`context/GeneratorContext.tsx` and the event→effect table). Pay particular attention to: locking behavior (a locked section's content survives both Generate and its own regenerate icon), the Fast-Punk/Half-Time shared-tempo vs Mid-Tempo independent-tempo split, and key persisting across Generator↔Chords navigation.

7. **Add audio** per `.kit/tech-stack.md` (Tone.js, shared Transport). If the audio approach decision (sampled vs. synthesized) hasn't been answered, default to synthesized.

8. **Verify.**
   - Run `npm run lint` and `npm run build`. Both must pass.
   - Walk `.kit/acceptance-criteria.md` top to bottom. For each item, either confirm it passes (and briefly say how you checked) or flag it as not yet done/deferred — don't silently skip items.

9. **Commit and open a PR** against `main` from your feature branch. In the PR description:
   - Summarize what was built.
   - List which of the 5 open decisions were used and whether they were defaults or user-specified.
   - Paste the acceptance-criteria results from step 8.
   - Note anything you deferred or couldn't verify, and why.

Do not merge the PR yourself.
