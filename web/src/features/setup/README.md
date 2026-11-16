# setup: settings and appearance studio

## Routes (`web/src/app/router.tsx`)

- `/settings`: `SettingsPage` (`pages/settings-page.tsx`), panes chosen by the `section` search.
- `/settings/appearance`: `AppearanceStudio` (`pages/appearance-studio.tsx`).

Guide topics (`navigation-map.json`): `settings_language_and_region`, `privacy_and_the_assistant`.

## Endpoints (`api.ts`, under `/api/v1`)

- `/settings`, `/books`, `/books/current`, `/books/current/{members,invitations,membership}`
- `/account-invitations`, `/access-tokens`, `/integrations`, `/ingestion/sync-schedule`
- `/assistant/{providers,presets,uses,usage,usage/days,usage/limits}`
- `/market-data/{feeds,refresh}`, `/exports`, `/imports/archive`
- `/me/{passkeys,totp,recovery-codes,second-factor}`
- `/institutions`, `/instruments`, `/payees`, `/aggregators`, `/connections`

## Folders

- `pages/`: the two routed components, their tests and styles.
- `settings-layout/`: group, row, section, navigation and pane shared by every pane.
- `model/`: topics, search validation and catalog labels used by several folders.
- `about/`, `account/`, `appearance/`, `calendars/`: one folder per pane.
- `ledger/`: book name, place and time zone.
- `members/`: members list, member removal, book creation, leaving and deletion.
- `invitations/`: book invitations and account invitations.
- `security/`: password, passkeys, TOTP and recovery codes.
- `assistant/`: status, providers, chain dialog and assistant start of the assistant pane (`docs/specs/2026-11-16-assistant-settings-design.md`).
- `usage/`: the route of each function, and the usage card with its rows, chart and limits.
- `integrations/`: integrations and their sync schedule.
- `external-access/`: access tokens and client snippets.
- `market-data/`: market data feeds.
- `backup/`: backup status and password copy.
- `data/`: export, import and replace of the book archive.
- `studio/`: panels, canvas and header of the appearance studio.
- `previews/`: scheme and typeface previews.
- `themes/`: theme gallery, miniature, import, rename and delete.
- `colours/`: book colour, seed swatches and status colours.
- `instruments/`: `useScale`, the instrument scale hook.
