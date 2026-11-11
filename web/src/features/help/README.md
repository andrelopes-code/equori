# help

Help pages of the application: a walkthrough, task steps, reference and explanations, rendered from Markdown bundled with the web build.

## Routes

Declared in `web/src/app/router.tsx`.

- `/help` renders `HelpIndexPage`.
- `/help/$page` renders `HelpPage`. The route rejects an id for which `isHelpPage` returns false.

## Entry components

`index.ts` exports `HelpIndexPage`, `HelpPage`, `HelpLink` and `isHelpPage`.

## Endpoints

None. `model/help-pages.ts` loads the Markdown through `import.meta.glob` with the `?raw` query. The feature has no `api.ts`.

## Guide topic

`getting_started`, for both `/help` and `/help/$page` (`web/src/navigation/navigation-map.json`).

## Folders

- `pages/`: the two routed components, their shared styles and the test of `HelpPage`.
- `featured/`: the featured pages block of the index.
- `kind-card/`: the card of one page kind and the entry of one page in it.
- `navigation/`: the navigation list of the page view and its item.
- `pager/`: the previous and next links of a page.
- `article/`: the rendering of one Markdown article and the body that wraps it.
- `link/`: `HelpLink`, a link to a help page, and its test.
- `model/`: the page catalog, the Markdown loader, the `useHelpPage` query hook and their tests.
- `content/`: Markdown sources, `<language>/<page id>.md` and `regions/<region>/<language>/<page id>.md`.
