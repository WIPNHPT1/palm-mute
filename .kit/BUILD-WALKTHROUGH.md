# Palm/Mute — Build Walkthrough (Claude Desktop App, No Terminal)

This is a complete, plain-English, step-by-step guide to turning this kit into a real, working website — entirely through the **Claude desktop app**. You never open a terminal, never install Node.js or Git yourself, and never type a command-line command. Everything technical happens inside Claude's own workspace when you ask it to, in plain sentences. The only things you do by hand are a few clicks on the GitHub and Netlify websites — because those two are the one-time, account-level permissions only you can grant.

**Total time:** about 15-20 minutes of you clicking and typing plain-English messages, plus 20-60 minutes where Claude is working on its own and you can walk away.

---

## Part 1 — Accounts you'll need (no installs, just two free sign-ups)

You do **not** need to install anything on your computer for this build. Claude does all the technical work — setting up the project, writing the code, testing it — inside its own workspace. You just need two free accounts, set up in your regular browser.

### Step 1: Create a free GitHub account

**GitHub** is the website that will store your project and its history, and where you'll be able to see everything Claude does, before and after you approve it.

1. Go to [github.com/signup](https://github.com/signup) in your browser.
2. Create a free account if you don't already have one.
3. Stay signed in — you'll use this in Part 3.

### Step 2: Create a free Netlify account

**Netlify** is the service that will host your finished website and give it a public link once it's built.

1. Go to [netlify.com](https://netlify.com).
2. Click sign up, and choose **"Sign up with GitHub"** specifically — this links the two accounts from the start, which makes Part 9 later much simpler.

That's the entire setup. No terminal, no installers, nothing else to configure.

---

## Part 2 — Look at what you're building

### Step 3: Open the mockup gallery

Before anything gets built, look at the actual design so you know what you're aiming for.

1. Find the zip file this kit came in and unzip it — on a Mac, just double-click it; on Windows, right-click it and choose **Extract All**.
2. Open the unzipped folder, then open the `mockups` folder inside it.
3. Double-click `index.html`. It'll open in your web browser (this works with no internet connection — it's just a local file).

Click through all 9 pages: the Generator, Chords, and About pages, each shown at Desktop, Tablet, and Mobile sizes. This is exactly what the finished app should look like. It's worth seeing this before the next steps, since everything else in this kit is about *how* to build these exact screens.

---

## Part 3 — Create your project's home on GitHub

### Step 4: Create an empty repository

A **repository** ("repo" for short) is just a project folder that GitHub tracks the history of.

1. Go to [github.com/new](https://github.com/new) in your browser (make sure you're signed in).
2. In the "Repository name" box, type `palm-mute`.
3. Leave everything else at its default — **do not** tick any box for adding a README, `.gitignore`, or license. This kit already includes those, and adding GitHub's versions too would just cause conflicts later.
4. Choose Public or Private — either is fine, it's your call.
5. Click **Create repository**.

Leave that browser tab open — you'll come back to it in a moment.

---

## Part 4 — Hand the project to Claude

### Step 5: Open the Claude desktop app and start a new conversation

Open the Claude desktop app on your computer and start a new conversation (or continue an existing one, if you're already in one when reading this).

### Step 6: Attach the kit to the conversation

Attach the zip file you downloaded (the one you unzipped in Step 3) to your message — either drag and drop it into the chat, or use the attach/paperclip button. You don't need to unzip it again for this step; Claude can open a zip file directly.

### Step 7: Ask Claude to connect to your GitHub repo and set everything up

In plain English, send Claude a message like this:

> "I want to build the Palm/Mute app from the attached kit. Please connect to my GitHub repository at `github.com/yourusername/palm-mute` (replace with your actual GitHub username), unzip the kit, and set it up inside that repo exactly as `BUILD-WALKTHROUGH.md` and `README.md` describe: the reference material goes in a `.kit/` folder, and `CLAUDE.md`, `.gitignore`, `.claude/commands/build-palm-mute.md`, and `.claude/settings.json` go at the top level. Then commit and push it."

Claude will handle getting access to your repository itself. You may see a one-time approval screen — click **Authorize** (or **Allow**) when it appears; this is GitHub confirming that you, personally, are granting this specific connection permission, and it only needs to happen once.

---

## Part 5 — A few quick decisions (or just skip them)

### Step 8: Decide how much you want to be asked

This kit's `README.md` lists 5 small judgment calls about how the app should behave in edge cases (for example: should a "dark mode" toggle actually work, or just be there for looks). Each one already has a sensible recommended answer.

You have three options — you don't need to decide right now, you can just say this at the start of Part 7:

- **Easiest:** tell Claude "use the recommended defaults for everything." This gets you a fully working app with zero extra decisions from you.
- **Pick your own:** answer any of the 5 questions yourself in your message; anything you don't mention falls back to the default.
- **Decide as you go:** don't answer anything now, and let Claude pause and ask you when it actually reaches each decision. (This means it'll stop and wait for you partway through, rather than running the whole thing in one go.)

For a first build, "use the recommended defaults" is the simplest path.

---

## Part 6 — How the safe auto-build routine works (nothing for you to switch on)

The files Claude just set up in Part 4 are what let it build the whole app safely without you approving every single tiny action:

- **`CLAUDE.md`** is a rulebook this kit wrote for Claude — things like "always work on a separate copy of the project, never change the main version directly, always test your own work before saying you're done." It's active automatically the moment it's in the project — nothing to turn on.
- **`.claude/settings.json`** is a pre-approved list: ordinary, safe, reversible actions (editing a file, saving progress, running a test) don't need your approval each time, but a short list of specific risky actions (like erasing history, or publishing straight to the live version) are blocked outright, no matter what. Anything not covered by either list still shows you an approval prompt in the chat before Claude does it.

In practice, this means: while Claude is building, you'll see it working with only occasional approval prompts (for anything genuinely outside the pre-approved list) rather than one for every step. That's the "auto mode" — safe by design, not by trusting Claude to self-police.

---

## Part 7 — Run the build

### Step 9: Ask Claude to build the app

In the same conversation, send:

> "Please read everything in `.kit/` (start with `.kit/README.md`), then build the Palm/Mute app per the plan in `.kit/repo-structure.md` and `.kit/tech-stack.md`. Use the recommended defaults for the open decisions in `.kit/README.md` unless I said otherwise above. Work on a separate branch, not the main version. When the build passes its checks and you've reviewed it against `.kit/acceptance-criteria.md`, open a pull request for me to review."

Then let it work. Roughly, here's what happens, in order:
1. Claude sets up a new website project (using the standard toolkit named in `tech-stack.md`).
2. It wires in the exact colors, fonts, and spacing from the design.
3. It builds the "brain" of the app — the code that works out chords and song structures.
4. It builds every visual piece (buttons, cards, panels), checking each against the mockups you looked at in Step 3.
5. It connects everything so clicking buttons actually does something.
6. It adds sound.
7. It runs a check to make sure nothing is broken.
8. It compares its own work against a checklist (`acceptance-criteria.md`) and reports the results.
9. It saves all of this as a **pull request** — a proposed change waiting for your review, not something already live.

This can take anywhere from 20 minutes to about an hour. You can step away during this — Claude will only interrupt you with a question if it hits something genuinely ambiguous or risky, per the rules in `CLAUDE.md`.

---

## Part 8 — Check its work before going live

### Step 10: Review the pull request on GitHub

A **pull request** ("PR" for short) is a proposed set of changes shown as a before-and-after, so you can look it over before it becomes official. Don't skip this, even though the build finished on its own.

1. Go to your repo on GitHub (`github.com/yourusername/palm-mute`) — you should see a banner or a "Pull requests" tab pointing at the new PR.
2. Skim the list of changed files. You're mainly checking that nothing looks like it's doing something outside the project or unrelated to what you asked for.
3. **To actually try the app without any terminal:** once Netlify is connected (Part 9 below), it automatically builds a live preview of every pull request and posts a clickable link right on the PR page — no local setup needed to test it. If you'd rather see it working before connecting Netlify, just ask Claude: "show me the app running" — Claude can start it temporarily in its own workspace and share a preview link with you directly in the chat.
4. Compare what you see against `mockups/index.html` from Step 3, at a few different browser window widths.
5. Read the PR's description — Claude should have listed which items from `acceptance-criteria.md` it checked and confirmed.

If everything looks right, click **Merge pull request** on the GitHub page. This makes it the official, permanent version of your project.

---

## Part 9 — Put it on the internet

### Step 11: Connect Netlify to your repo

1. Go to [app.netlify.com](https://app.netlify.com) and log in (you signed up with GitHub in Step 2, so this should already be linked).
2. Click **Add new site → Import an existing project**.
3. Choose **GitHub**, and authorize it if asked.
4. Select `palm-mute` from the list of your repos.
5. Netlify automatically detects the build settings from a file already in your project (`netlify.toml`) — you shouldn't need to type or choose anything here.
6. Click **Deploy**.

The first deploy takes a couple of minutes. From now on, every time changes are merged into the main version of your project on GitHub, Netlify automatically rebuilds and updates the live site — and, as mentioned in Step 10, every future pull request also gets its own preview link automatically.

### Step 12: Check the live site actually works

Once Netlify shows the deploy finished, it gives you a web address (something like `random-name-123.netlify.app`).

- Open that address directly in a fresh browser tab for each of these three pages: the home page, `/chords`, and `/about`. (This checks each page loads correctly on its own — not just by clicking around inside the app, which can sometimes hide a problem.)
- Try playing a chord's audio, if the build included sound.
- Ask Claude to "go through `acceptance-criteria.md` one more time against the live site" — a small number of things can behave differently once deployed versus in Claude's own workspace, so it's worth one more pass.

**You're done.** You now have a real, working, deployed prototype with a public link you can share — and you never opened a terminal.

---

## Making changes later

For any future tweak or feature, open a conversation with Claude and describe what you want changed in plain English — you don't need to re-attach the kit, since it already lives in your GitHub repo. The same safety rules in `CLAUDE.md` still apply automatically: Claude will work on a new branch and open a new pull request rather than changing the live site directly.

---

## Troubleshooting

**Claude wants to publish changes straight to the main version, skipping review.** This shouldn't happen if `CLAUDE.md` made it into the repo correctly in Part 4. Ask Claude to confirm it read `CLAUDE.md` — it should say yes and describe the branch/PR rule back to you.

**A pull request's preview link shows an error, but the description says everything passed.** Ask Claude directly: "the deploy preview for this PR is showing an error, can you check why and fix it?" Deploy environments occasionally surface issues (like a missing file reference) that don't show up during the build step itself.

**The fonts or colors look different on the live site than in the mockups.** Ask Claude to double check that `tailwind.config.js` and the font link in the app's main layout file match the ones from the kit exactly, rather than being retyped or approximated.

**I don't see an approval prompt I was expecting, or Claude seems stuck waiting.** Scroll up in the conversation — an approval request can sometimes be easy to miss. If Claude explicitly says it's waiting on something, that's the moment to check for a prompt to click.

---

## Glossary

- **Repository (repo)** — a project folder tracked on GitHub, along with its full history of changes.
- **Commit** — a saved, labeled snapshot of a set of changes.
- **Push** — uploading saved changes to GitHub. Claude does this on your behalf once it's connected to your repo.
- **Branch** — a separate, safe copy of the project to make changes in, so the main version isn't touched until those changes are reviewed. This kit always has Claude work on a branch, never directly on the main version.
- **Pull request (PR)** — a proposed set of changes shown as a before-and-after, waiting for someone to review and approve it.
- **Merge** — approving a pull request, making its changes official and part of the main version.
- **Deploy** — publishing the built website so it's live on the internet.
- **Deploy preview** — a temporary, live, clickable version of the app that Netlify automatically builds for each pull request, so you can try it out before merging.
