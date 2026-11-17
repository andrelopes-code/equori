# Help: index and page

The help holds 14 Markdown pages. The index lists them as three cards by kind; a page draws its text with the list of every page beside it. A reader with a task has no search, the index does not follow the areas of the app, a symptom is reachable only by opening one long page, and no page shows the screen it describes.

The approved mock is the contract of the form: `docs/specs/assets/2026-11-17-help-mock/` (owner, 2026-11-17, concept A "Guia", round 3, one change: the assistant button carries no shortcut key). `design.css` moves to the feature's stylesheets without edits and the markup follows `design.html` element by element.

## 1. Scope

- The routes stay `/help` and `/help/$page`. No endpoint is added: pages, figures and videos are files of the web build.
- The index gains a search, the walkthrough as a path of its steps, the pages by area of the app, the symptoms and the glossary terms.
- A page gains its sections beside the text, numbered steps, figures of the app with the place of a step marked, an optional video, the action that opens the screen, and a closing block "If something went differently".
- Out of scope: a figure or a video for every page (section 6 lists what ships), progress of the walkthrough (the overview shows it), a server-side search, help content in the assistant's guide beyond the article of the topic.

## 2. Decisions

| ID | Decision |
|---|---|
| HP1 | Order of the index, confirmed by the owner on 2026-11-17: search, walkthrough, pages by area, symptoms and glossary. Order of a page: steps with media, the action that opens the screen, the sections, related pages and previous/next. The list of every page leaves the page view; the index holds it. |
| HP2 | A page is parsed by `parseHelpPage` into a title, a lead (first paragraph), blocks before the first section, and sections. A section is a level-two heading; its id is the `{#id}` written after the heading text, or the slug of the title. A block is text, steps (an ordered list), a figure (a paragraph holding one image), a term (a paragraph that opens with a bold word and a colon) or a pointer (a last paragraph of the form `Word: [link](…)`). |
| HP3 | A figure is written as a Markdown image: `![alternative text](figure-id "caption")`. An image on a continuation line of a list item is the figure of that step. An image whose id ends in `.webm` before an ordered list is the video of those steps. The figure id names files of `media/`: `<id>.dark.png`, `<id>.light.png`, `<id>.dark.webm`, `<id>.light.webm`. `media/media.json` holds, per figure, the marks (a rectangle in percent of the figure) and, per video, its length in seconds. |
| HP4 | A figure draws the capture of the active scheme, its mark as an outline with the step number, and the rest of the capture dimmed. "Enlarge" opens the capture in `MediaViewer`. Both captures are lazy-loaded. |
| HP5 | Steps with figures: from 1024 px of page the steps stand beside one stage; choosing a step changes the figure, and the stage holds the Figures/Video control, the count "Step n of m" and the previous/next pair. Below 1024 px each step is followed by its figure and the video stands above the steps. Steps without figures are the numbered list alone. |
| HP6 | A video is muted, has controls, never starts alone (`preload="none"`), and its steps are its text equivalent (WCAG 1.2.1, 2.2.2). |
| HP7 | The catalog `help-pages.ts` gains per page: `area` (the block of the index), `screen` (the route the header action opens), `symptoms` (section ids of `troubleshooting`) and `related` (page ids). The header action reads "Open {screen}" with the screen's navigation label and is drawn only when the route is served. |
| HP8 | The index reads every page of the reader's language once (`helpLibraryQuery`), with the regional passage. While it loads, the rows draw placeholders. A symptom is a section of `troubleshooting` with a written id; a term is a term block of `glossary`. |
| HP9 | Search (`searchHelp`), owner 2026-11-17 ("a search that is really efficient"): reads page titles, section titles, glossary terms and the text. Case and diacritics are ignored. Every word of the query must match a word of the entry: by prefix, or by edit distance 1 when the query word has 5 letters or more. Order: page titles, section titles, terms, text. The first result is drawn apart with the sections of its page. A page listed by title or section is not repeated in the text group. The query lives in the search parameter `q` of `/help`. |
| HP10 | Search keys: `/` focuses the field on `/help` and opens `/help?q=` from a page; arrow down and up move the active result; Enter opens it; Escape clears the query. Every result is also a link reachable by Tab. |
| HP11 | A search without results states what the search reads, lists up to three entries that match one word of the query, and offers the assistant. "Common searches" under an empty field are links that fill the query. |
| HP12 | "Ask the assistant" is an own element: the assistant's mark inside the ring it wears while answering, over a wash of the same colours (owner 2026-11-17: a unique, prominent button). It opens the assistant panel and places the question (the query or the page title) in the composer; nothing is sent. Families read: `button` (one fill per variant, no ring, no second line). The need is this product's identity, not a Slotted finding. |
| HP13 | One row serves the directory, the symptoms, the results and the links at the end of a page: one height, one inset, one hover. A rule opens a group; rows carry no rule. The directory carries no icon (owner 2026-11-17). |
| HP14 | The text of a page is `lg`, the lead `xl`. From 1024 px of page the sections stand in a column before the text (`TableOfContents`, vertical, sticky); below, the list folds above the text. The layout reads the page's width (`usePageWide`), never the viewport: today the list falls below the text at 1440 px of viewport. |
| HP15 | The page `troubleshooting` draws each symptom as cause, steps and pointer, labelled "Cause", "How to fix" and "More". |
| HP16 | A page of kind `howto` ends with the section "If something went differently": the symptoms of the task, the assistant, and the related pages. Any other page ends with the assistant alone. |
| HP17 | Own elements, built under `build-own-element`: the path of the walkthrough, the row, the step list with its stage, the figure with its mark. Families read: `stepper` (states of a process the user is in, with a current step and completion; the path is a list of links), `list-item` (its row height follows the content and its end slot holds one element), `carousel` (slides without a list that drives them), `image` (no mark over the picture). None is a Slotted finding: each is this screen's form. |

## 3. Derivation

- `model/parse-help-page.ts`: `parseHelpPage(text)` and `slug(title)`. Pure, tested with the pages of both languages.
- `model/help-library.ts`: `helpLibraryQuery(language, region)` loads and parses the 14 pages; `symptomsOf`, `termsOf`.
- `search/search-help.ts`: `searchHelp(library, query)` returns the best result, the groups with their counts, the ranges to highlight and the near entries. Pure, tested with the 14 pages.
- `media/help-media.ts`: the URLs of a figure and of a video (`import.meta.glob`), the marks and the lengths of `media.json`.
- `features/assistant/model/ask-assistant.ts`: `askAssistant(question)` and `useAssistantAsk(handler)` over a window event; the shell opens the panel and the panel fills its composer.
- Components draw only: one file per block, per row and per layout (`walk` beside and stacked).

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no regional value is added. The regional passages keep their extension point ("Help passages", `docs/contributing/regions.md`). |
| R2 | A region without a passage reads the base page, as today. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | The texts of the index, the search, the steps, the figure and the closing block are catalog keys `help.*` in pt-BR and en. The alternative text and the caption of a figure are written in the Markdown of each language. A figure shows the app in pt-BR in both languages (section 6). |
| R6 | The count of results, the count of terms, "Step n of m" and the length of a video are written through `numberFormatter`. |
| C1 | Does not apply: no amount is stored or computed. |
| C2 | Does not apply. |
| C3 | Does not apply. |
| C4 | Does not apply: the amounts inside a figure are pixels of a capture of the demo book. |
| T1 | Does not apply: no date is used. |
| T2 | Does not apply. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply. |
| D2 | Does not apply. |
| D3 | Does not apply. |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | Does not apply: no operation. |
| S2 | Yes: `/help` and `/help/$page` are phone routes (ADR 027, S3). The phone forms are those of the mock at 390 px. |
| S3 | Yes: the article of the topic `getting_started` describes the search, the index by area and the steps with figures, in the same commit as the screens. |
| S4 | No: the assistant already reads the guide. The button passes the question as text. |
| X1 | None: no scenario of `06-scenarios.md` is added. |
| X2 | Does not apply: R1, R2 (no new behavior) and C2 to C3 do not apply. The existing tests of the regional passage (BR, PT) stay. |

## 5. Tests

- `parse-help-page.test.ts`: sections and ids, steps with figures, a video, a term, a pointer, for a page of each language.
- `help-pages.test.ts`: every page but the walkthrough, the glossary and the symptoms has an area; every symptom and related id of the catalog exists in both languages; every figure and video named in a page has its files and its entry in `media.json`.
- `search-help.test.ts`: order of the groups, diacritics, one changed letter, a query without result and its near entries, no repeated page.
- `help-page.test.tsx`: the index by area, the search through `q`, the keys, the empty search with the assistant; the page with its sections, steps, figure, closing block and header action; the phone route.
- `ask-assistant.test.ts` and the panel test: the question reaches the composer and the panel opens.
- Changed expectations of `help-page.test.tsx`: the index no longer lists by kind (HP1), and the page no longer holds the list of every page (HP1).

## 6. Media shipped

| Page | Figures | Video |
|---|---|---|
| `pay-statement` | the five steps of "Record the payment"; the total of the statement | the payment, start to end |
| `troubleshooting` | the total of the statement, under "The amount of a statement differs" | none |

The captures come from the demo book in pt-BR, 1280 by 800, in both schemes, written by `docs/specs/assets/2026-11-17-help-media/capture.mjs` (Playwright is not a dependency of `web/`; the script runs with the Playwright of the machine). Every other page keeps its text and gains its figures in later changes of content, without code.
