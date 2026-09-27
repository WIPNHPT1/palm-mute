# Palm/Mute — Project Instructions for Claude Code

This file is read automatically at the start of every Claude Code session in this repo. It exists to make autonomous ("auto mode") work on this project safe by default — so you can say "build it" or "add X" and walk away without worrying about a bad command doing something irreversible.

## What this project is

Palm/Mute is a pop-punk songwriting web app: a power-chord/song-structure generator in E standard tuning, styled as a "tape deck" aesthetic. The full spec lives in `.kit/` (design tokens, component spec, data model, interaction spec, tech stack, repo structure, acceptance criteria) and the visual reference lives in `mockups/index.html` (9 static pages — always check these before styling anything). Read `.kit/README.md` first in any session that touches design or behavior.

## Non-negotiable safety rules

These apply to every session, whether a human is watching or not:

1. **Never commit or push directly to `main`.** All work happens on a feature branch (`feature/<short-description>` or `fix/<short-description>`). Open a PR when the work is ready for review; do not merge your own PR.
2. **Never force-push, to any branch.** If history needs fixing, fix it forward with a new commit.
3. **Never run destructive git operations** (`git reset --hard`, `git clean -fd`, `git checkout -- .` on uncommitted work, deleting branches other than your own throwaway ones) without the user explicitly asking for that specific operation in that session.
4. **Never skip hooks or checks** (`--no-verify`, disabling lint/type-check, commenting out a failing test to make CI green). If a check fails, fix the underlying issue or stop and report it — don't route around it.
5. **Never delete files outside this repository**, and never run commands that could affect the wider system (no `sudo`, no modifying global config, no touching anything outside the working directory).
6. **Never commit secrets.** No `.env` files, API keys, or credentials — check `.gitignore` covers them before your first commit if it doesn't already.
7. **Before opening a PR, always run the build and lint** (`npm run build`, `npm run lint`) and confirm they pass. Include the results in the PR description. If something doesn't pass and you can't fix it, say so explicitly in the PR rather than opening it silently broken.
8. **Self-check against `.kit/acceptance-criteria.md` before calling any build "done."** Report which checklist items you verified and how (not just "looks good").

## Working style for this project

- Treat `.kit/data/*.json` as the single source of truth for content (chords, progressions, rhythm patterns, song titles). Never hardcode chord/tab strings that already exist in that data.
- Treat `.kit/design-tokens.json` (via `tailwind.config.js`) as the single source of truth for colors, spacing, and type. Components use Tailwind classes, not inline styles — the mockups use inline styles only because that's a constraint of the design tool they came from; don't carry that pattern into the real app.
- When a mockup and a written spec seem to disagree, the mockup wins for anything visual; the spec wins for anything behavioral it covers that the mockup can't show (a static screenshot can't show what happens on click).
- The 5 open decisions in `.kit/README.md` (originality-check rigor, locked-section behavior, dark mode, audio approach, Chorus-highlight logic) should be resolved using the recommended defaults unless the user has said otherwise in this session or in a `DECISIONS.md` file at the repo root (create one if the user gives you answers, so future sessions don't have to ask again).
- This is a stateless client-side prototype — no backend, no user accounts, no persistence beyond what's explicitly in scope. Don't add infrastructure that isn't asked for.

## When something is genuinely ambiguous

Stop and ask, rather than guessing, if:
- A request conflicts with something already built and it's not obvious which should win.
- You're about to make a decision that would be expensive to undo (a major dependency choice not already locked in `.kit/tech-stack.md`, a data-model change that would invalidate existing content).
- The build or deploy is failing for a reason you can't diagnose after a reasonable attempt.

Otherwise, prefer making a reasonable call, documenting it (in the PR description or a code comment), and moving forward — that's what makes autonomous mode actually useful.

## Commands

- `npm run dev` — local dev server
- `npm run build` — static export build (must pass before any PR)
- `npm run lint` — lint (must pass before any PR)

## Custom slash command

`/build-palm-mute` (in `.claude/commands/`) runs the full initial build end-to-end per `BUILD-WALKTHROUGH.md` §6. Use it for the first build or a full rebuild; for incremental changes, just describe what you want changed and the safety rules above still apply.
