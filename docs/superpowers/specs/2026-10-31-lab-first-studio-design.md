# WinkelAmp studio: the lab becomes the product

Date: 2026-10-31. Status: approved direction (the user: "the goal is to move towards the visualizations as they are in the
demo page… please don't get yourself restricted because of some prototype we made earlier… just start the build").
Supersedes the constraints of `2026-10-30-scripted-visuals-design.md` and `docs/DESIGN.md` where they conflict.

## Why

The user tried the widget lab (`lab/index.html`): canvas "widgets" that play from notes transcribed ahead of time from a
real recording by a GPU piano transcriber. They loved it ("something I've been wanting to make my whole life") and liked it
far more than the app's live microphone/MIDI listening and WebGL stage. The precomputed notes are why the lab feels tied to
every chord: a live analysis can never be that exact. So the product becomes the lab, grown up.

## What it is

A studio where a person drops in a recording of a piece (the great masters first: Rachmaninoff, Beethoven…), and gets a
visual show built from the widget collection, section by section, in sync with every attack; they can watch it full-screen,
reshape it with the mouse (which widgets, where the sections change, the knobs), have Claude compose it from a description
in words, and export it as an MP4 to share (WhatsApp).

## Goals

1. **Song packs.** Any recording → a pack, computed once and cached: transcribed notes (GPU piano transcription; see
   `.superpowers/ears/brief.md` for the transcriber), sections, beats, loudness, chords (reuse the existing study analysis:
   `scripts/study.ts`, `src/audio/*`). CLI: `npm run ingest -- <audio> [--id <slug>]`. A small local server (`npm run ears`)
   lets the studio ingest a dropped file; when it isn't running, the studio falls back to an in-browser analysis (the
   existing offline analysis's onsets + melody as approximate notes) and says so.
2. **One widget collection, two front ends.** The lab's widgets (`lab/tools/*.js`, the `TOOLS.push({...})` contract, the
   `ctx` they get, knobs with hints/icons/drives) are the single source. The studio runs the same files through a TypeScript
   runtime with the same `ctx` contract, so a widget that looks right in the lab looks identical in the studio. The lab stays
   the place where new widgets are sketched and rated.
3. **Shows.** A show is JSON: the song, and sections (start, end, label) each with a stack of widgets (id + knob overrides
   + drives). Transitions keep the shared canvas: at a boundary the outgoing widgets stop receiving attacks and decay for a
   few seconds while the incoming ones start, so the casket's cuts can still slice what came before. Shows live in
   `shows/<id>.json` (committed; audio and packs are not). A validator checks them.
4. **Auto-composer.** For a song without a show, compose a default from the pack: sections from the analysis, widgets chosen
   from the user's loved/kept ones by each section's character (loud/dense/low/fast/quiet), so every song plays well at once.
5. **Studio UI** (the new main page): song library and drop zone; a full-screen player; a timeline of sections (coloured by
   widget, boundaries draggable, split/merge); a side panel for the selected section: its widget stack (add from the
   collection, remove, reorder) and each widget's knobs (the lab's knob UI: pictures at both ends, plain hints, "fixed /
   louder → more…" drives); undo; save the show. Keyboard: space, arrows, F full-screen, H hide UI.
6. **Claude composes.** `docs/COMPOSING-SHOWS.md`: how a Claude Code session turns a pack + the user's words into a show JSON
   (the widget catalogue with what each is for, generated from the widget files), plus `npm run check-show`. A "Describe the
   show" box in the studio saves the user's description next to the show so a session can pick it up.
7. **Export.** In-app recording to MP4 (H.264 + AAC; auto-stops and saves at the end of the song; bitrate capped so a minute
   is a few MB, not 250) and a deterministic offline renderer for exact, smooth HD videos: `npm run render-show -- <show>`
   (frame-by-frame, real audio muxed; the lab's `lab/render.mjs` approach).
8. **The old app** stays reachable at `legacy.html` (microphone, MIDI, the WebGL stage), untouched; it is no longer the
   main page.

## Non-goals (for now)

- Live microphone/MIDI visualisation in the studio. Porting widgets to WebGL. Rewriting widgets in TypeScript beyond what the
  runtime needs. A server-side backend: everything runs locally.

## Anti-goals

- Anything that makes the studio look or move differently from the lab for the same widget and knobs.
- Physical/literal imagery (the user's taste: abstract).

## Constraints

- Audio, packs and rendered videos never go into git. No new npm dependencies unless essential (say why).
- Strict TS for new TypeScript; tests for pure logic (show validation, auto-composer, chord grouping, drives, transitions).
- Must run on the user's Windows machine with Chrome; Python venv `C:/Users/maxim/.venvs/wa` for the transcriber.
