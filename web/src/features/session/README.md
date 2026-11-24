# session

Authentication, first-user setup, invitations and per-user state of the signed-in person.

## Routes

Defined in `web/src/app/router.tsx`.

| Route     | Component    |
| --------- | ------------ |
| `/login`  | `LoginPage`  |
| `/setup`  | `SetupPage`  |
| `/invite` | `InvitePage` |

## Guide topic

`web/src/navigation/navigation-map.json` has no entry for these routes.

## Endpoints (`api.ts`)

- `GET /me`, `PATCH /me`
- `GET /me/books`, `PUT /session/books`
- `GET /me/appearance`, `PUT /me/appearance`
- `GET /setup`, `POST /setup`
- `POST /invitations/preview`, `POST /invitations/accept`
- `POST /session`, `POST /session/second-factor`, `DELETE /session`

## Folders

- `pages/`: the three route components, their tests and the shared `login-page.module.css`.
- `login/`: password form, code form and second-factor step of the login.
- `passkey/`: WebAuthn ceremony and the base64url codec it uses.
- `invite/`: invitation preview, new-member form, token reading and acceptance.
- `setup/`: first-user form, its account and books fields, submit hook, currency and region choices.
- `appearance/`: sync of the saved appearance to the document.
- `logout/`: `useLogout` hook.
- `model/`: book storage keys, remembered device user and `reloadHome`, used by several folders.

`index.ts` holds the public exports; `routes.ts` holds what the router imports. `model/session-queries.ts` holds the queries the router runs. `api.ts` holds the queries and mutations.
