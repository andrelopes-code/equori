# Password change: design

- Status: proposed
- Date: 2026-11-03
- Extends: `docs/specs/2026-10-30-households-access-design.md` (HA numbering), ADR 003, ADR 030
- Inputs: security check of 2026-11-03 (`.claude/progress/current.md`, slice 8)

## 1. Goal

A member changes the own password, and the host operator sets the password of a member who lost it. Today `api/openapi.yaml` has no operation that writes a password hash after `POST /api/v1/setup` or `equori user create`, so a leaked password cannot be rotated without recreating the member.

## 2. Terms

| Term | Meaning |
|---|---|
| Session | A row of `identity_session`, held by the cookie `equori_session`. |
| Pending login | A row of `identity_login_challenge`, held by the cookie `equori_login` (ADR 030). |
| Access token | A bearer credential of `identity_access_token` (ADR 024). |

## 3. Current state

Read on 2026-11-03 at `322db4d8`.

| Topic | State | Source |
|---|---|---|
| Hash write | Only `CreateMember` and the setup flow store `PasswordHash`. | `internal/identity/internal/app/service.go:173` |
| Password rule | 12 to 256 runes. | `domain.ValidatePassword` |
| Password check for a sensitive action | `checkPassword` counts against the login throttle of the email (5 attempts in 15 minutes) and resets it on success. | `internal/identity/internal/app/second_factor.go:616` |
| Operations without a tool | `disableTotp`, `removePasskey` and the other `/me/*` operations of the second factor map to `-session` in `exposure`. | `internal/server/tool_exposure_test.go` |
| Session removal | `DeleteOtherSessions` and `DeleteMemberSessions` exist; `ResetSecondFactor` runs them under `withMemberLock`. | `internal/identity/internal/adapter/postgres/second_factor.go` |
| CLI | `equori user create` and `equori user reset-second-factor`. | `cmd/equori/user.go` |

## 4. Decisions

- HA56. `POST /api/v1/me/password`, operationId `changePassword`, `x-book-role: read`, tag `identity`, body `ChangePasswordInput` with `current_password` and `new_password`, both required, `additionalProperties: false`. Success answers 204.
- HA57. The service checks `current_password` with `checkPassword`. A wrong password answers 403 `password_invalid`. Attempts count against the login throttle of the email, so the sixth wrong attempt in 15 minutes answers 429 `too_many_attempts`.
- HA58. `new_password` passes `domain.ValidatePassword`. A shorter or longer value answers 422 `validation_failed` on field `new_password`. A value equal to `current_password` answers 422 `validation_failed` on field `new_password`.
- HA59. In one transaction under `withMemberLock` the operation stores the new argon2id hash, deletes every session of the member except the caller's, and deletes the pending logins of the member. The second factor and its recovery codes stay unchanged.
- HA60. No tool exposes the operation: it maps to `-session` in `exposure`. An access token opens `/mcp` only (ADR 024, X11), so it cannot call `changePassword`.
- HA61. `equori user set-password --email EMAIL` reads the password from stdin as `create` does, validates it with `domain.ValidatePassword`, stores the hash, and deletes every session and every pending login of the member. It leaves the second factor unchanged. An unknown email exits with a non-zero status and the message of `reset-second-factor`.
- HA62. Both paths log `password changed` with `member_id` and `via` (`api` or `cli`). No log record holds a password or a hash.
- HA63. The settings screen of the member gets a form with `current_password`, `new_password` and a confirmation field. The confirmation is checked in the browser and is not sent. The success message states that the other sessions ended. The form follows `docs/contributing/forms.md`.

## 5. Region-dependent values

None. The rule of HA58 is the same in every region.

## 6. Scenarios

| ID | Scenario |
|---|---|
| S273 | A member changes the password through `changePassword`. A login with the old password answers 401 `invalid_credentials`. A login with the new password succeeds. |
| S274 | A member holds two sessions and changes the password through the first. The second answers 401 on its next request. The first stays valid. |
| S275 | `changePassword` with a wrong `current_password` answers 403 `password_invalid` and leaves the hash unchanged. The sixth wrong attempt in 15 minutes answers 429 `too_many_attempts`. |
| S276 | `changePassword` with a `new_password` of 11 runes, and with a `new_password` equal to the current one, each answer 422 `validation_failed` on `new_password`. |
| S277 | A member with TOTP holds a pending login and a session. `equori user set-password` deletes both. A login with the new password asks for the second factor. |

Each scenario has a test through `internal/apitest` whose name or comment carries the ID. S277 runs the command function of `cmd/equori` against the harness database.

## 7. Documents changed with the code

- `api/openapi.yaml`: `changePassword`, `ChangePasswordInput`.
- `internal/server/tool_exposure_test.go`: `changePassword` as `-session`.
- `docs/domain/06-scenarios.md`: S273 to S277.
- `docs/adr/030-second-factor.md`: a bullet that a password change keeps the second factor.
- `docs/adr/003-authentication.md`: an amendment naming HA56 to HA62.
- `docs/install/` and `docs/operations/`: the command `equori user set-password` where `reset-second-factor` is described.
- `cmd/equori/user.go`: `userUsage`.
- `web/src/i18n/catalog.en.ts` and `catalog.pt-BR.ts`: the labels and messages of the form.

## 8. Open decisions

| Decision | Recommendation | Effect |
|---|---|---|
| Access tokens after a change | Keep them (HA59 as written). | A leaked password that created a token before the change leaves the token alive until the member deletes it on the token list. |
| Revoke every access token on change | Offer it as an optional field `end_access_tokens`, default `false`, after the first version. | MCP clients of the member stop working until a new token is created. |
| Reset of a forgotten password by e-mail | Not planned. | The instance has no outgoing mail; the host operator uses HA61. |

## 9. Out of scope

| Item | Reason |
|---|---|
| Password strength meter, breached-password lookup | No dependency is added (CONTRIBUTING, Code). |
| Change of e-mail address | Separate operation. |
| Password change of another member by an admin through the API | HA61 covers the host operator; the API has no operation that writes another member's credential. |
