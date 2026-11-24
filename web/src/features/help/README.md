# help

Help pages of the application: a walkthrough, task steps, reference and explanations, rendered from Markdown bundled with the web build.

## Routes

Declared in `web/src/app/router.tsx`.

- `/help` renders `HelpIndexPage`.
- `/help/$page` renders `HelpPage`. The route rejects an id for which `isHelpPage` returns false.

## Entry components

`routes.ts` exports `HelpIndexPage`, `HelpPage` and `isHelpPage` to the router; `index.ts` exports `HelpLink`.

## Endpoints

None. `model/help-pages.ts` loads the Markdown through `import.meta.glob` with the `?raw` query, and `media/help-media.ts` resolves the figures and videos. The feature has no `api.ts`.

## Guide topic

`getting_started`, for both `/help` and `/help/$page` (`web/src/navigation/navigation-map.json`).

## Design

`docs/specs/2026-11-17-help-design.md`; the approved mock is `docs/superpowers/mocks/2026-11-17-help-mock/` (local).

## Folders

- `pages/`: the two routed components and their test.
- `index/`: the blocks of the index: the walkthrough path, the pages by area, the symptoms, the terms.
- `search/`: the search function, its field, its results and its keys.
- `article/`: one page: its sections beside the text, its blocks, the symptom layout.
- `steps/`: numbered steps, alone, beside their figure or each followed by it, and the video.
- `figure/`: a capture of the app with its mark, and the way to enlarge it.
- `after/`: what closes a page: symptoms of the task, the assistant, related pages.
- `header/`: the actions of the page header.
- `row/`: the row every list of links shares.
- `pager/`: the previous and next links of a page.
- `link/`: `HelpLink`, a link to a help page, and its test.
- `icon/`: the marks the glyph set does not hold.
- `model/`: the page list, the guides (area, screen, symptoms, related), the Markdown loader and parser, the library of every page.
- `styles/`: the stylesheet of the approved mock.
- `media/`: one folder per tutorial with its figures (`<id>.<language>.<scheme>.png`) and the stills of its video (`<hash>.png`, one file per distinct still), and `media.json` (the mark of each figure, the timeline, stills and accent of each video, the hash of each file), all written by `tools/help-media` (`docs/contributing/help.md`, "Figures and videos"); `help-media-files.gen.ts` lists the files for the bundler, written by the same tool; `help-media.ts` and `use-help-media.ts` resolve them.
- `content/`: Markdown sources, `<language>/<page id>.md` and `regions/<region>/<language>/<page id>.md`.

## Writing a page

- `## Title {#id}` gives a section an id that is the same in every language.
- An ordered list is drawn as numbered steps. `![alternative text](figure-id)` on an indented line under a step is the figure of that step.
- `![alternative text](video-id.video)` in its own paragraph before the list is the video of those steps. `video/` draws it on a canvas from its stills (`docs/specs/2026-11-18-help-video-composed-design.md`).
- `![alternative text](figure-id "caption")` in its own paragraph is a figure in the text.
- A figure id is a beat of a tutorial of `tools/help-media`; `make help-media` builds its files.
