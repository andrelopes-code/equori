# Help video composed in the browser

- Status: accepted (owner, 2026-11-18)
- Amends: ADR 037, decisions 7 and 9 and its consequences; `docs/specs/2026-11-17-help-design.md`, HP3 and HP6.

## Decision

The video of a help page is no longer a file. The page draws it on a canvas, at the moment of viewing, from the lossless stills of the tutorial's steps and from a timeline written by `tools/help-media`. Owner decisions of 2026-11-18, not reopened:

1. No Git LFS, no external store, no generation of media in CI. The media lives in Git.
2. The `.webm` files cease to exist. The compositor that `tools/help-media/lib/video.mjs` held draws the video on the help page.
3. Quality is equal to or higher than the `.webm`: stills in lossless PNG at the capture resolution (3840 by 2400, two device pixels per CSS pixel), with no resizing and no lossy format; the same timeline (travel 0.9 s, step hold 1.7 s, bridge hold 0.5 s, click 0.6 s, cross-fade 0.3 s, end 1.4 s), pointer, numbered mark, click ring, cross-fade and accent colour. The canvas draws at the resolution of the still, and the page reduces it to the size of the player.
4. No ceiling on the length or weight of a video. The length adds no bytes; the weight depends only on the number of distinct stills.
5. The figures (`<figure>.<language>.dark.png`) stay as they are.
6. `CONTRIBUTING.md`, section Setup, documents the partial clone (`git clone --filter=blob:none`).
7. `make help-media-check` prints the `size-pack` of the repository (`git count-objects -v`). Above 3 GiB it prints a line that names the amendment of ADR 037 to reopen. It does not fail on it.
8. The local history `origin/main..main` is rewritten to hold only the final version of the media (section "History").

Rejected: WebP from Chromium at quality 1. It is not lossless (73 to 145 pixel values differ) and is larger than the PNG.

## Data

`tools/help-media build` writes, per tutorial with `video: true` and per language:

- each still of the video as `media/<tutorial>/<short hash>.png`, where the short hash is the first 12 hexadecimal digits of the SHA-256 of the PNG. A still equal to another (same SHA-256) is written once.
- an entry `videos.<tutorial>.<language>` in `media.json`:

| Field | Content |
|---|---|
| `parts` | one per beat of the video, in order: `start`, `travel`, `hold`, `click` in seconds, `number` (0 for a beat the page does not number), `mark` (`x`, `y`, `width`, `height` in CSS pixels of the 1920 by 1200 screen) |
| `duration` | seconds from the first frame to the last, the end hold included |
| `fade` | seconds of the cross-fade between two stills |
| `stills` | the file of each part, in the order of `parts`; a file repeats when two parts show the same screen |
| `accent` | the accent colour of the theme the stills were taken in, as the browser computes it |

The length shown on the page ("Video · 15 s") is `Math.round(duration)`.

`check` refuses: a still missing, a still whose SHA-256 differs from `files`, a still not named by the 12 digits of its own hash, a still that is not 3840 by 2400; a list of stills of another length than `parts`; a part whose `start` is not the sum of the parts before it, a `travel`, `hold`, `click` or `fade` outside the constants of the tool, a `duration` other than the end of the last part plus the end hold; a mark outside the 1920 by 1200 screen or smaller than 1 px; a folder of `media/` with more than 40 files.

## Compositor

`web/src/features/help/video/` holds the one compositor:

- `compose-frame.ts`: pure functions. `frameAt(video, t)` returns the state of the frame at second `t`: the index of the still, the still before it and the opacity of the cross-fade, the pointer position, the opacity of the mark, the progress of the click and the press of the pointer. `restingAt(video, t)` returns the instant of the same part at which the pointer rests and the mark is whole, for reduced motion. `partAt`, `nextPart` and `previousPart` serve the keys.
- `draw-frame.ts`: the canvas layer. It draws a frame state on a 2D context of 3840 by 2400 with the geometry of the former compositor, multiplied by two device pixels per CSS pixel in place of four thirds. A canvas shadow is not scaled by the transform, so the blur and offset of the pointer shadow are written per device pixel: 6 and 2.25 times the ratio, the 8 and 3 device pixels of the 2560 px frame.
- The number of the mark uses `--slotted-font-family-sans` (Geist), read from the page, in place of `system-ui`.

`tools/help-media review` reads both files, strips their types with `node:module` `stripTypeScriptTypes` and inlines them in `out/review.html`. The review page plays the video with the code of the application and holds no copy of it.

## Player

`HelpPlayer` (the dialog that grows over the page, `docs/specs/2026-11-17-help-design.md` HP6) holds `HelpCanvas` in place of `<video>`:

- The first still is shown at once as an `<img>` (the poster), before any other still is fetched. The other stills of the language are fetched when the player opens, which is the press of the play button on the page. The animation starts when every still is decoded; the poster stays until then.
- Controls under the picture: a play and pause `IconButton` whose name says what the press does next, a Slotted `Slider` for the position in seconds, the time written as `0:04 / 0:15` through `numberFormatter`, and `FullscreenTrigger` on the panel.
- Keys while the focus is in the player: space plays or pauses; the left and right arrows go to the start of the previous or next part. On the slider the arrows are the slider's own (one step of 0.1 s; Shift by 1 s).
- Reduced motion (`prefers-reduced-motion: reduce`): the player does not play alone; each frame drawn is the resting frame of its part, so a step appears whole, with its mark and pointer, and no travel, fade or ring is drawn. Play advances step by step at the timeline's pace.
- The canvas carries `role="img"` and the name of the video (the alternative text of the Markdown); the steps listed beside the player are its text equivalent (WCAG 1.2.1).
- Focus: each control draws its Slotted focus ring. The canvas takes no focus and draws none (owner, 2026-11-18, HP6 third amendment).

The video is offered in every browser with a 2D canvas: the condition "plays WebM VP9" is removed, so Safari before 14.1 and iOS before 17.4 get the video.

## Measurements

Weight per tutorial and language, the `.webm` of commit `8ef3d0a8` against the distinct stills of this build:

| Tutorial | Language | `.webm` (B) | Parts | Distinct stills | Stills (B) |
|---|---|---|---|---|---|
| check-balance | pt | 1 765 149 | 4 | 3 | 1 375 810 |
| check-balance | en | 1 762 069 | 4 | 3 | 1 353 260 |
| import-statement | pt | 2 894 359 | 5 | 5 | 1 876 089 |
| import-statement | en | 2 808 603 | 5 | 5 | 1 833 994 |
| pay-statement | pt | 2 987 501 | 6 | 4 | 2 407 037 |
| pay-statement | en | 2 887 942 | 6 | 4 | 2 366 425 |
| category-rule | pt | 3 073 989 | 9 | 6 | 1 828 165 |
| category-rule | en | 2 922 006 | 9 | 6 | 1 746 624 |
| Total | | 21 101 618 | | 36 files | 14 787 404 |

Four stills of `check-balance` and of `import-statement` hold the same bytes (the screens both tutorials pass through); each tutorial keeps its copy in its folder and Git stores each blob once.

Time to the first frame, measured on the production build (`web/dist`) answered by the tape of `pay-statement` (pt), from the press of "Watch the video" (Playwright 1.64.0, Chromium 1248, one run each):

| Condition | Poster drawn | First frame of the canvas |
|---|---|---|
| 1440 by 900, no throttling | 125 ms | 1 018 ms |
| 1440 by 900, CPU 4×, network 10 Mbit/s and 40 ms | 1 231 ms | 3 848 ms |
| 390 by 844, CPU 4×, network 10 Mbit/s and 40 ms | 1 376 ms | 3 968 ms |
| 1440 by 900, reduced motion | 104 ms | 853 ms |

The interval between the poster and the first frame is the fetch and decoding of the other stills (3840 by 2400 each). The poster is the first frame of the video, so the reader sees the first frame at the poster time; the animation starts at the canvas time.

## Comparison with the `.webm`

Every frame of the `.webm` (decoded by the ffmpeg 1013 of Playwright, VP9 to PNG) is compared with the frame the compositor draws at `n / 30` s, reduced to 2560 by 1600. The value of a pixel is the largest difference of its three channels, from 0 to 255; a strong difference is above 64.

| Variant | Frames | Mean difference | Strong pixels, worst frame (of 4 096 000) |
|---|---|---|---|
| check-balance pt | 390 of 390 | 2.32 | 1 600 |
| check-balance en | 390 of 390 | 2.32 | 1 766 |
| import-statement pt | 450 of 450 | 2.25 | 1 619 |
| import-statement en | 450 of 450 | 2.25 | 1 768 |
| pay-statement pt | 528 of 528 | 2.12 | 835 |
| category-rule pt | 690 of 690 | 2.29 | 1 720 |
| category-rule en | 690 of 690 | 2.29 | 1 599 |
| pay-statement en | the run stopped at frame 85 of 528: the system ran short of memory | | |

The frame count is equal in every variant. The strong pixels lie on the edges of the text: the `.webm` passed through a JPEG and VP9 at CRF 24, the stills through no lossy step. Frames 10, 40, 85 (click), 100 (cross-fade), 130 (mark of step 2) and 200, read at 1× and at 2×, show the same pointer, mark, ring, cross-fade and accent. One difference is not sharpness, and is the decision of this spec: the number of the mark is drawn in Geist in place of `system-ui`.

The first build of the stills showed one more difference, fixed in the tool: the dialog of `pay-statement` focused the amount field again after the capture removed the focus, and its ring reached the figure `pay-amount.pt`. `capture.mjs` now removes the focus until the page rests with nothing focused; every figure is equal byte for byte to the figure of `8ef3d0a8`.

## History

The rewrite runs last, in a working clone inside the session scratchpad, on `origin/main..main`. In each commit, every blob under `web/src/features/help/media/` with the extension `.png` or `.webm` that is not in the tree of the tip is removed from the index (`git filter-branch --index-filter`; `git filter-repo` is not installed). Author, dates, message and every other path stay. The new tip is accepted only when its tree equals the tree of the old tip. The shared checkout receives it by `git update-ref refs/heads/main <new> <old>`; index and working tree do not change. The ref `backup/pre-media-rewrite` keeps the old tip.

## Cross-cutting questions

- R1: Does not apply: the player and the tool hold no regional value.
- R2: Does not apply: no region-dependent behavior.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: `help.video.play`, `help.video.pause`, `help.video.position`, `help.video.time` in pt-BR and en. The full-screen labels are the Slotted `Fullscreen` messages of the language in force.
- R6: The time of the player and the length of the video are written through `numberFormatter` of the active tag; the slider's `aria-valuetext` through its `format` and `locale`.
- C1: Does not apply: no amount.
- C2: Does not apply: no amount.
- C3: Does not apply: no amount.
- C4: Does not apply: no currency.
- T1: Does not apply: no date. The tape's fixed clock is unchanged.
- T2: Does not apply: no business day.
- B1: Does not apply: no table.
- B2: Does not apply: no operation; the media are files of the web build.
- B3: Does not apply: no setting. Reduced motion is the browser's preference.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: no field of the diagnostic file.
- S1: Does not apply: no operation of `api/openapi.yaml`.
- S2: `/help/$page` is a phone route (ADR 027, S3). Below 1024 px the player stacks the picture over the steps, as before; the controls sit under the picture at the target size of the families.
- S3: `internal/assistant/guide/articles/getting_started.md` states the player's controls and drops the sentence on WebM VP9.
- S4: Does not apply: the assistant links help pages; it reads no media.
- X1: Does not apply: no scenario; no HTTP behavior changes.
- X2: Does not apply: R1, R2 and C2 to C3 do not apply.

## Tests

- `video/compose-frame.test.ts`: the frame at the start, inside the travel, at rest, inside the click and inside the cross-fade; the resting instant of each part; previous and next parts at the bounds.
- `video/help-canvas.test.tsx`: the poster before the stills load, the play and pause name, space and arrows, reduced motion does not play alone.
- `pages/help-page.test.tsx`: the player opens on the press, holds the canvas of the video's language and the steps, and closes.
- `model/help-pages.test.ts`: every video named in a page has its stills and its timeline in `media.json` for each language.
- `tools/help-media/lib/*.test.mjs` (`node --test`): naming by hash, deduplication, the checks of the timeline.
