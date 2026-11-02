# CODEX: THIS IS YOUR DOCUMENT. START HERE.

You are Codex (Sol 6.1), working for the owner of this repo, Maxim. This file is your whole brief. If you were told to read "the handoff", it means this file: `CODEX-HANDOFF.md` in the repo root.

`docs/HANDOFF.md` is a different document: a long history written by and for other agents. Read it only when a task below sends you there. It does not tell you what to do.

Do the tasks one at a time, in the order below unless Maxim names one. When something here seems to conflict with another file, this file wins, except for the rules from Maxim, which always win.

## What this project is

WinkelAmp is a music visualizer for the great masters. A **widget** is one abstract animation driven by the notes of a real recording, in sync with the attacks. Widgets are sketched in the **lab** (`lab/`, one file each in `lab/tools/`), rated by Maxim, and placed on a timeline in the **studio** (`src/studio/`).

Read `lab/README.md` before touching a widget. It explains the knob rules and has the helper list.

## Setting up your folder

The repo's main branch is `claude/wizardly-franklin-ttaqyo`. Work in your own worktree, in `.claude/worktrees/`, on your own branch from that main. Do not work in the repo's root folder or any other worktree: Maxim's servers and other agents use them.

Your worktree will not have what git does not hold. Link and copy these in, from the worktree root:

```bash
cmd //c mklink //J songs "C:\Users\maxim\Desktop\projects\github\WinkelAmp\.claude\worktrees\ambitious-project-continuation-ff6d7f\songs"
```

```bash
cmd //c mklink //J node_modules "C:\Users\maxim\Desktop\projects\github\WinkelAmp\.claude\worktrees\ambitious-project-continuation-ff6d7f\node_modules"
```

Then copy `lab/*.mp3`, `lab/notes*.js` and `lab/pack-*.js` from `.claude/worktrees/picker-and-modulators/lab/` into your `lab/`. Copy, and do not change anything in that folder. Start your server with `npx vite --port 5200 --strictPort` and stop it when done. The lab is at `http://localhost:5200/lab/index.html`.

## Rules that are never broken

- **Never merge anything into `claude/wizardly-franklin-ttaqyo`, the main branch, and never merge your branch anywhere.** Work on your own branch, `codex/<task>`, push it, and report. Claude or Maxim does the merging.
- Maxim runs servers on ports **5174, 5175, 5177 and 5178**. Never use, stop or restart them. Use free ports from 5200 up. Stop only what you started, by exact process id, after checking its command line.
- **Port 5174 saves Maxim's ratings.** Every test browser must route `http://localhost:5174/**` to a stub. See any script in `lab/*.mjs` for how. Never edit `lab/ratings.json`.
- Never commit audio, `songs/`, `lab/notes*.js`, `lab/pack-*.js`, rendered videos, `.superpowers`, or model weights. They are not in git on purpose.
- `songs/` holds transcriptions that exist only on this machine. If your working folder links to it, **unlink it before deleting that folder.** A recursive delete through the link would destroy them for good.
- Never touch `shows/*` or `melodies/*` unless Maxim asks. Those are Maxim's work.
- Never enter, read or print passwords, tokens or keys.
- Nothing you do may disturb the lab's sound or playback.

## How to work

- Write code that reads like the code around it: same comments, same naming.
- Small commits, one concern each. Run the tests, read the result, and only then commit.
- Before reporting a task as done, these must pass: `npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.scripts.json`, `npx vitest run`, `npm run check-show`, `npm run widget-docs -- --check`.
- The widget list in `docs/COMPOSING-SHOWS.md`, between its markers, is generated: run `npm run widget-docs` and never edit that part by hand.
- If a check fails, say so and show the output. Never report a thing as done that you did not run. If you could not judge something by eye, say that too.
- When a task is unclear, stop and ask Maxim. Do not invent aesthetic decisions: you are here for careful work, and taste is Maxim's.
- Report in plain words, no jargon: what changed, what you checked, what you could not.

## The tasks

### 1. Widget health check

Add one browser check, `npm run widgets-check`, using the lab's render mode (`?render=1&only=<id>&song=<id>`, `window.renderReady`, `renderSeek`, `renderTo`, `renderErrors`; `lab/thumbs.mjs` shows how). For every widget, on at least 3 different songs, at "how present" low and high:

- Report any error thrown.
- Report a picture that stays blank for the whole run.
- Report when "how present" low makes no less than high.

Do not compare pictures pixel by pixel. Maxim on this: "Do we really need pixel perfection? I don't think so. e2e tests will only catch regressions that cause programmatic errors." Write no other browser tests unless a task asks for one.

It writes a table and exits non-zero on errors. Do not fix what it finds unless the fix is one obvious line; list the rest for Maxim. Run it one browser at a time.

**Done when:** the command runs across all widgets and you have reported its table.

### 2. Speed table

Add `npm run widgets-speed`, measuring the time per frame of each widget on two busy songs, and write the table to `lab/speed.md`, worst first. Then, only where it does not change how the widget looks, fix the worst in plain ways: reuse canvases instead of making new ones, use `willReadFrequently` where a widget reads pixels, avoid `filter` per object where one blur will do.

**Done when:** the table exists, and each fix looks the same in rendered frames and shows a measured gain. Never change how a widget looks to make it faster; list those for Maxim instead.

### 3. Old code report

`legacy.html`, `stage-test.html`, `living-test.html` and `src/stage/` may no longer be used. Find out what actually still depends on them. Write `docs/unused-code.md`: what is unused, what is still used and by what, and what could be removed.

**Do not delete anything.** Maxim decides from your report.

### 4. Docs after the timeline

The studio no longer has sections. `docs/HANDOFF.md`, `docs/COMPOSING.md` and `lab/README.md` may still describe them. Correct what is now false, briefly, without rewriting history: a dated entry describing past work stays as it is. Also convert any script the timeline work left unconverted, if the timeline's report names one.

### 5. Background colours for small copies

Only once Maxim says transparent small copies are in. Black goes see-through, but about a dozen widgets paint their own background, so they stay solid rectangles (Miro, Matisse, Kusama, Boogie, Lewitt, Martin, Score and others), and a few leave a dark veil (Gust, Royal). Add the one-line background colour to the ones Maxim names, and show Maxim each result over a coloured picture.

### 6. New widgets, from recipes

Recipes are in `CODEX-WIDGET-RECIPES.md`, in the repo root. Build all 12, in that file's order. Do not stop to ask between them: if one does not work as written, commit what you have, write what fell short in `lab/codex-report.md`, and go on.

A recipe's numbers are not suggestions. Follow it to the letter, including its traps. If a recipe does not work as written, do not improvise something prettier: build it as written, show Maxim, and say what fell short.

For each widget:

1. One file, `lab/tools/<id>.js`, `tag: 'new'`, built like the others. Read `lab/tools/squares.js` for the knob format and `lab/tools/fireworks.js` for one with its own WebGL canvas. Nothing touching `document` at the top level of the file: create canvases inside `frame`.
2. For "how present", do what `CODEX-WIDGET-RECIPES.md` says under "Things every recipe assumes".
3. Add the id to `TOOL_IDS` in `lab/index.html` and an entry in `lab/tags.json` (feel words must exist in `lab/tag-words.json`).
4. Add `lab/demos.json` entry and make its clip with `npm run widget-demos -- <id>`. Make its thumbnail with `npm run widget-thumbs -- <id>`. Run `npm run widget-docs`.
5. Render frames on the song the recipe names and look at them. Check what is listed under the recipe's "done when".
6. One commit per widget, on `codex/new-widgets`, with the recipe's id in the message. Push after each one.

Do not touch any existing widget in this task. Do not rate anything.

## What stays with Claude

Do not start these: the Tree widget, polishing widgets Maxim loves, how Duet and Fireworks look, the transparency mechanism itself, the studio's timeline, and the shared widget code in `src/widgets/` and `lab/layers/`. If a task seems to need a change there, stop and ask.
