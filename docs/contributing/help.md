# Help pages

The help pages are the documentation for people who use equori. They live in `web/src/features/help/content/`, are served inside the application at `/help`, and work offline because the binary embeds them with the web interface. Design: `docs/specs/2026-10-29-ui-clarity-design.md`.

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
