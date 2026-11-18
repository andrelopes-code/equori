# Help pages

The help pages are the documentation for people who use equori. They live in `web/src/features/help/content/`, are served inside the application at `/help`, and work offline because the binary embeds them with the web interface. Design: `docs/specs/2026-10-29-ui-clarity-design.md` and `docs/specs/2026-11-17-help-design.md`.

## Kinds

Each page is one kind of Diátaxis, declared in `helpPages` of `web/src/features/help/help-pages.ts`:

| Kind | Answers | Example |
|---|---|---|
| `tutorial` | a walkthrough from start to finish | `first-month` |
| `howto` | the steps of one task | `pay-statement` |
| `reference` | what a screen or a term means | `glossary`, `statement` |
| `explanation` | the idea behind the screens | `how-money-is-recorded` |

A page holds one kind only.

## Adding a page

1. Pass the curation of the design (section 5): a page exists for a screen that has a concept of its own, or for a task or idea a reader asks about.
2. Write `content/<language>/<id>.md` for every language of `web/src/i18n/languages.ts`. The first line is the title as a level-one heading; the paragraph after it is the lead the help index shows.
3. Add `{ id, kind }` to `helpPages`.
4. Add the id to the tasks of `/help/$page` in `web/src/navigation/navigation-map.json`, so the assistant can link the page.
5. When a selected screen explains itself through the page, draw `HelpLink` with the page id in its header actions.

`help-pages.test.ts` fails when a page lacks a language or opens without a title.

## Writing

- The writing rules of the design (section 5.3) apply: sentences of at most 20 words, a term explained right after it, one name per concept, the words the screens use.
- A label of the interface is written in bold, exactly as the screen shows it in that language.
- A link to a screen or to another page is a relative path (`/accounts`, `/help/glossary`); it becomes a router link.
- A neutral page names no regional value: no currency, institution, tax, index, payment system, aggregator or identifier scheme. A fact of one region goes in its passage (`docs/contributing/regions.md`, "Help passages"); the test rejects the names of the known regional systems in a neutral page.

## Figures and videos

A figure or a video is built by `tools/help-media` (ADR 037). No file of `web/src/features/help/media/` (one folder per tutorial) is edited, drawn, recorded or placed by hand; `make help-media-check` rejects a file the tool did not write.

| Command | Does | Needs |
|---|---|---|
| `make help-media-record` | records the reads of each tutorial on `tutorials/<id>.tape.json` | `make demo`, `make run-dev` |
| `make help-media` | builds every figure and the stills and timeline of every video from the tapes, in each language, and checks them | `make web-build` (the target runs it) |
| `make help-media-check` | checks the written media against `media.json` and the pages, without a browser, and prints the `size-pack` of the repository; `make static`, CI and the pre-push hook run it | nothing |
| `make help-media-review` | writes `tools/help-media/out/review.html`: every figure under its mark, every video played by the compositor of the application | a build |

A video is no file: the help page draws it on a canvas from the stills of its steps (`<tutorial>/<hash>.png`, 3840 by 2400, lossless) and the timeline of `media.json` (`docs/specs/2026-11-18-help-video-composed-design.md`). A build takes under a minute per tutorial: its variants are built at once (`HELP_MEDIA_JOBS`, 4 by default). A tutorial whose inputs did not change (the build of the application, the tutorial, its tape, the tool, the pages) is skipped; `node run.mjs build --force` builds it anyway.

The figures show the application as it ships: its default theme and density. A preference of the recorded account never reaches a figure. After a change of the default appearance, `make help-media` rebuilds every tutorial; the marks are measured again, so a change of size needs no edit of a tutorial.

### Adding media to a page

1. Write the figures in the Markdown of every language (`web/src/features/help/README.md`, "Writing a page"): a figure id per step, and the video id with the suffix `.video` before the list.
2. Write `tools/help-media/tutorials/<id>.mjs`. A beat is `{ figure, target, frame, act, only }`:
   - `target(page, words)` returns the Playwright locator of the element the step points at, or a list of locators whose union is marked. `words(pt, en)` picks a label by language.
   - `figure` is the id the Markdown names. A beat without one is a click the page does not number; it appears in the video only.
   - `frame(page)` is the region the figure is cut around when it fits (a dialog). Without it the figure stays inside the page region of the 1920 px screen (ADR 037, 4). An element wider than 912 px does not fit in a figure: point at its parts.
   - `act(page, words)` is what the reader does after the step: one click, a text typed in a field, or a file of `tutorials/files/` chosen. A tutorial never confirms a write: it stops before the button that sends.
   - `only: "figure"` keeps a beat out of the video. A beat with `only: "figure"` and no `figure` appears nowhere: it is a click that leads to the next figure.
   - `reads` at the top of the tutorial lists the requests with a body that change nothing, as `"POST /api/v1/rules/preview"`. `record` sends them and keeps their answers; any other write is refused. A text typed before such a request is the same in every language, so one recorded answer serves both.
3. `make help-media-record`, then `make help-media`.
4. `make help-media-review` and read the page: each mark surrounds its element, each figure shows the words of its language, the video shows each step in order.
5. Commit the tutorial, its tape, the media and `media.json` together.

### Rules

- A locator names a role, a label or a part of the interface; never a position, an index into unrelated elements or a generated class.
- A tutorial holds no coordinate, no size and no wait. A beat that needs one is a defect of the tool; fix the tool.
- A screen whose change moves, renames or removes an element of a tutorial rebuilds the media in the same commit.
- The tape holds the demo book only (`make demo`); it is never recorded from a book with real data.

