# Households and access: design

- Status: accepted
- Date: 2026-10-30
- Phase: P11 of `docs/domain/09-roadmap.md`, section 9.4
- Decision records: ADR 029 (amended), ADR 003 (amended), ADR 030 (new, second factor)
- Inputs: `tmp/ideas.md` section 07 phase 3, `docs/specs/2026-10-30-shared-books-design.md` sections 5 and 10, ADR 003, ADR 024, the code at commit `eef03181`, the owner's answers of 2026-10-30

## 1. Goal

Exit criterion of P11, quoted from section 9.4.2: "An HTTP test per role and per access without membership (404); login tests with TOTP, with a passkey and with a recovery code."

P11 also takes the browser keys under the books ID, the last row of section 5 of the shared-books design, moved to P11 by the owner on 2026-10-30.

## 2. Terms

Terms of the shared-books design (books, member, membership, instance role, book role, active book) keep their meaning.

| Term | Definition |
|---|---|
| Required book role | The lowest book role an operation accepts: `read`, `write` or `owner`, or `public` for an operation without a session. Ranks: `read` < `write` < `owner`. |
| Authorization point | The one middleware that resolves the operation of a request, authenticates the session and compares the member's book role with the required book role. |
| Invitation | A single-use link, created by an owner, that adds one email to one book with one book role. |
| Second factor | A TOTP code, a passkey or a recovery code, asked after the password of a member who enabled TOTP or registered a passkey. |
| Pending login | The state between a correct password and a correct second factor: a row and a cookie that expire in 5 minutes. |
| Recovery code | A single-use code that replaces the other second factors once. |

## 3. Current state

- `identity.RequireSession` (`internal/identity/internal/adapter/httpapi/server.go`) authenticates every `/api/` request except the paths of `isLogin` and `isSetup`. No code reads `identity_membership.role`.
- `internal/platform/contract` resolves the OpenAPI route of a request (`Validator.route`) and runs after `RequireSession` (`internal/server/server.go`).
- `api/openapi.yaml` has 218 operations. `internal/server/tool_exposure_test.go` maps each to a tool or an exclusion.
- The MCP grant has `Write = scope == "write"` (`internal/server/server.go`); a read grant reaches only `tool.ReadOnly` tools (ADR 024, X14).
- The tool `update_profile` changes the member's language and the book's region (`internal/identity/internal/adapter/toolapi/profile.go`).
- `assistant_conversation` and its messages and proposals are keyed by `books_id` only.
- Instance-role checks exist in `marketdata` (feeds) and `ingestion` (sync schedule), both 403 `admin_required`.
- Four browser keys hold IDs of one book: `equori.capture.defaultAccount`, `equori.capture.queue`, `equori.recent-categories`, `equori.plan.collapsed`; `equori.device.user` holds `{id, email}` of the member for the offline queue (ADR 022, P4a).
- The web has no QR code library (`web/package.json`). Go has no WebAuthn or TOTP dependency (`go.mod`).
- Identity problem codes in use: `validation_failed`, `invalid_request`, `time_zone_invalid`, `appearance_too_large`, `invalid_credentials`, `unauthenticated`, `too_many_attempts`, `setup_token_invalid`, `setup_complete`, `access_token_not_found`, `server_busy`.

## 4. Decisions

Each table has the columns ID, decision and reason. The plan cites the ID and does not repeat the reason.

### 4.1 Books and the active book

| ID | Decision | Reason |
|---|---|---|
| HA1 | `identity_books` gains `name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80)`. The migration fills it with the email of the book's owner with the lowest member ID. Setup, `equori user create` and `createBooks` without a name use the creating member's email. `PATCH /api/v1/books/current` takes `name` with `region` and `time_zone`; `BooksSettings` returns it. | The switcher needs a label per book. An email is not a regional word, so no catalog text enters SQL (CONTRIBUTING, Regions). |
| HA2 | `identity_membership` gains `last_active_at timestamptz NOT NULL DEFAULT now()`, filled with `created_at`. Login, a switch and an accepted invitation set it to the current time. | BK12 defers the last-active-book rule to P11. A column on the membership disappears with the membership, so no dangling reference remains. |
| HA3 | Login opens the session in the membership with the greatest `last_active_at`, ties broken by the lowest `books_id`. The rule replaces BK12 and the login sentence of the ADR 003 amendment of 2026-10-30. | A member returns to the book of the last visit. After the migration each member has one membership, so the first login after the upgrade opens the same book as before. |
| HA4 | `PUT /api/v1/session/books` with `{books_id}` moves the current session to that book: it updates `identity_session.books_id` and the membership's `last_active_at`. A books ID without a membership of the member is 404 `books_not_found`, also when the book exists. | A session belongs to one membership (BK6); updating the row keeps the cookie. 404 instead of 403 does not reveal that another book exists (`tmp/ideas.md` section 07, decision 4). |
| HA5 | `GET /api/v1/me/books` lists the member's memberships: `id`, `name`, `role`, `active`. `GET /api/v1/me` gains `books_id` and `book_role` of the active book. | The switcher needs every book; the shell needs the active book and role before any other request. |
| HA6 | `POST /api/v1/books` with `{name, region, base_currency?}` creates a book and an `owner` membership for the member, in one transaction, and publishes `identity.books_created.v1` (BK13). A missing base currency is the region's default (`Config.DefaultCurrency`, as in setup). The session stays in its book; the web switches with HA4. | Section 07 covers a couple with personal and joint data as three books; without book creation two members have only their two personal books. The event already creates the ledger settings of a book at setup. |
| HA7 | The instance role grants no book access. An `admin` reads a book only through a membership. | ADR 029 isolates data by book; the instance role governs instance settings and members (ADR 003), not data. |

### 4.2 Authorization point

| ID | Decision | Reason |
|---|---|---|
| HA8 | Each operation of `api/openapi.yaml` declares `x-book-role` with one of `public`, `read`, `write`, `owner`. | The contract is the source of truth of operations (CONTRIBUTING, Layout); the required role sits beside the operation it guards and appears in the API documentation. |
| HA9 | `identity.Authorize` replaces `identity.RequireSession`. It resolves the operation through the router of `internal/platform/contract`. For `public` it passes the request. Otherwise it authenticates the session, reads the membership role in the same query as the session row, and answers 403 `book_role_required` when the role ranks below the required one. A path under `/api/` without an operation requires a session, then reaches the 404 of the mux. An operation without `x-book-role` is 403 `book_role_required` at run time. | One place decides every request (`tmp/ideas.md` section 07, the Actual Budget defect). Reading the role per request applies a role change on the next request. Deny by default keeps a new operation protected without opting in, as `RequireSession` does today. |
| HA10 | `isLogin` and `isSetup` are removed; `createSession`, `getSetup`, `completeSetup`, `previewInvitation`, `acceptInvitation` and `completeSecondFactor` declare `public`. | The bypass list moves into the contract, so HA9 has one source. |
| HA11 | Order in `internal/server/server.go`: `Authorize`, then `Validator.Middleware`, then the mux. | A member without the role receives 403 before the body is validated, so a refused request learns nothing about the operation's schema. |
| HA12 | A test fails when an operation lacks `x-book-role` or carries another value, and when an `owner` operation maps to a tool in `tool_exposure_test.go` instead of an exclusion. | The same pattern as the tool exposure test (ADR 012, T14) keeps the classification complete as operations grow. |
| HA13 | Classification rule. `public`: the operations of HA10. `owner`: the membership and invitation operations of section 4.3 and 4.4 except `listMembers` and `leaveBooks`; `updateCurrentBooks`; `updateSettings` (base currency); `createProvider`, `updateProvider`, `deleteProvider`, `setUseChain`, `setUsageLimit`; `importArchive`. `read`: every `GET`, and every operation that changes only rows of the member, of the session or of the instance: `deleteSession`, `switchBooks`, `createBooks`, `leaveBooks`, `updateCurrentUser`, `setMemberAppearance`, `createAccessToken`, `deleteAccessToken`, `sendAssistantMessage`, `rejectAssistantProposal`, `deleteAssistantConversation`, `deleteAssistantConversations`, `requestExport`, the second-factor operations of sections 4.7 to 4.9, `setSyncSchedule` and the feed operations of `marketdata`. `write`: every other operation. The plan lists every operation with its value. | Owner operations change who reaches the book, its identity, the meaning of every amount (base currency), the provider keys and spend of the book, or replace data in bulk. A `read` member must reach every view, its own conversations and an export, which accountants and carers need (section 07, delegated access). |
| HA14 | `setSyncSchedule` and the feed operations keep their `admin_required` check in their modules. | The instance role is outside the book role; moving it is not needed for the exit criterion. |
| HA15 | `internal/platform/auth` carries the book role: `WithIdentity` takes it and `MustBookRole(ctx)` returns it. `Authorize` and the MCP grant set it. | The assistant module chooses its tool set by role without importing `identity` (ADR 002). |
| HA16 | The MCP grant writes only when the token scope is `write` and the membership role is `write` or `owner`. `VerifyAccessToken` returns the role. `createAccessToken` with scope `write` by a `read` member is 403 `book_role_required`. | A token never exceeds its member's role; reading the role at each verification applies a demotion to existing tokens. |
| HA17 | The in-app assistant of a `read` member offers only `tool.ReadOnly` tools. | The same rule as a read token (ADR 024, X14); `confirmAssistantProposal` is `write`, so a proposal never runs, and offering write tools would only produce refused proposals. |
| HA18 | `update_profile` drops its `region` argument and changes only the member's language. `updateCurrentBooks` becomes the exclusion `-owner` in `tool_exposure_test.go`. | Tools run under any `write` grant and do not see `x-book-role`; the region is an `owner` setting. |

### 4.3 Membership management

| ID | Decision | Reason |
|---|---|---|
| HA19 | `GET /api/v1/books/current/members` (`read`) lists `member_id`, `email`, `role`, `created_at` of every membership of the active book. | Each member sees who reaches the book's data. |
| HA20 | `PATCH /api/v1/books/current/members/{memberId}` (`owner`) with `{role}` changes a role. `DELETE /api/v1/books/current/members/{memberId}` (`owner`) removes a membership. `DELETE /api/v1/books/current/membership` (`read`) removes the caller's own membership. An unknown member ID in the book is 404 `member_not_found`. | Self-removal needs no owner role; a separate operation keeps one required role per operation (HA9). |
| HA21 | A change that leaves the book without an `owner` is 409 `last_owner`. The check locks the book row (`SELECT ... FOR UPDATE` on `identity_books`) before it counts owners. | Without an owner nobody can manage members or invitations. The lock makes two concurrent demotions yield one owner, not zero. |
| HA22 | Removing a membership deletes its sessions and access tokens (BK6) and the member's conversations in that book (HA28). A member left without memberships receives `invalid_credentials` at login (ADR 003, amendment of 2026-10-30). | The cascade already exists; conversations follow the membership because they quote the book's data. |

### 4.4 Invitations

| ID | Decision | Reason |
|---|---|---|
| HA23 | Table `identity_invitation`: `id uuid PRIMARY KEY`, `books_id bigint NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE`, `email text NOT NULL`, `role text NOT NULL CHECK (role IN ('owner', 'write', 'read'))`, `token_hash bytea NOT NULL UNIQUE`, `invited_by bigint NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL`, `expires_at timestamptz NOT NULL`, `UNIQUE (books_id, email)`. | One pending invitation per email and book; the hash follows the session token rule (ADR 003). |
| HA24 | `POST /api/v1/books/current/invitations` (`owner`) with `{email, role}` returns the invitation and its token once. The token is 32 random bytes in base64url; the row stores its SHA-256. Expiry is 7 days. A second invitation of the same email replaces the first. An email that already has a membership in the book is 409 `already_member`. `GET` lists pending invitations without tokens; `DELETE .../invitations/{id}` revokes one. Expired rows are deleted when the book's invitations are listed or created. | Notices stay inside equori (section 9.4.1), so the owner sends the link through a channel of their choice. Seven days cover a week in which the invitee does not read the message. |
| HA25 | The web builds the link `<origin>/invite#token=<token>`. `POST /api/v1/invitations/preview` (`public`) with `{token}` returns the book name, the inviter's email, the role, the invited email and `member_exists`. An unknown or expired token is 404 `invitation_not_found`. | The fragment never reaches server logs, as in the setup link (ADR 003, amendment of 2026-10-27). No public URL setting exists, so the browser supplies the origin. |
| HA26 | `POST /api/v1/invitations/accept` (`public`) with `{token, password?, language?}`. When no member has the invited email, `password` and `language` are required (422 `validation_failed`), and it creates a member with instance role `member`, the given password (ADR 003 rules) and language, adds the membership, deletes the invitation and starts a session in that book, in one transaction. When a member has the email, the request needs that member's session cookie: it adds the membership, deletes the invitation and moves the session to the book (HA4). Without a session it is 401 `unauthenticated`; with a session of another email it is 403 `invitation_email_mismatch`; with an existing membership it is 409 `already_member`. | Owner decision of 2026-10-30: a book owner invites a new email, and acceptance creates the member. Self-registration stays impossible: acceptance needs a token. Binding to the email makes the owner choose the person, not whoever holds the link. |
| HA27 | The web keeps the token in `sessionStorage` key `equori.invite.token` while an existing member logs in, and deletes it after acceptance or a 404. | The login step leaves the invite page; `sessionStorage` ends with the tab, so the token does not persist on the device. |

### 4.5 Assistant conversations

| ID | Decision | Reason |
|---|---|---|
| HA28 | `assistant_conversation` gains `member_id bigint NOT NULL`, filled with the owner of the book with the lowest member ID, and the foreign key `(member_id, books_id)` to `identity_membership ON DELETE CASCADE`. Every conversation query filters by `books_id` and `member_id`. A conversation of another member is 404. Usage and limits stay per book. | Shared-books design section 10 moves the privacy of conversations to P11: a conversation holds one person's questions. Before P11 each book has one member, so the fill is exact. Spend is a book matter (ADR 019). |
| HA55 | The export archive carries no row of `assistant_conversation`, `assistant_message` or `assistant_proposal`. Archive version 5 drops the three tables from older archives (ADR 021, V2). | An export by any member would otherwise carry the conversations of the other members (HA28), and a conversation row names a member that another instance does not have. Owner decision of 2026-10-30. |

### 4.6 Browser keys under the books ID

| ID | Decision | Reason |
|---|---|---|
| HA29 | `equori.capture.defaultAccount`, `equori.capture.queue`, `equori.recent-categories` and `equori.plan.collapsed` become `<key>.<booksId>`. | Their values hold IDs of one book; a key per book keeps a switch from showing or recording IDs of another book. |
| HA30 | `equori.device.user` keeps its name and gains `booksId`, the active book of the last online session. The offline page reads the queue of that book. This amends the last row of shared-books design section 5 for this key. | Offline the browser has no session answer; one fixed key must name the book whose queue it reads. |
| HA31 | On the first authenticated load, a key of HA29 without suffix moves to the suffix of the member's `owner` membership with the lowest `books_id` (from HA5), and the unsuffixed key is deleted. | Under BK12 every session opened in that book, so every unsuffixed value was written there. |
| HA32 | A switch reloads the page at `/`. | Every query cache and every key of HA29 is per book; a reload discards all of them at once. |

### 4.7 TOTP

| ID | Decision | Reason |
|---|---|---|
| HA33 | TOTP follows RFC 6238 with SHA-1, 6 digits, a 30-second step and a window of one step before and after. The secret is 20 random bytes. The implementation uses the standard library (`crypto/hmac`, `crypto/sha1`, `encoding/base32`). | Authenticator apps ignore other parameters. The algorithm is a few lines over the standard library (CONTRIBUTING, Code). |
| HA34 | Table `identity_totp`: `member_id bigint PRIMARY KEY REFERENCES identity_member (id) ON DELETE CASCADE`, `sealed_secret bytea NOT NULL`, `confirmed_at timestamptz`, `last_step bigint NOT NULL DEFAULT 0`, `created_at timestamptz NOT NULL`. The secret is sealed with the secret box (ADR 008), associated data binding the table and the member ID (K3). A code whose step is not above `last_step` is refused. | A leaked database yields no secret. Storing the last step refuses a replayed code. |
| HA35 | `POST /api/v1/me/totp` returns the secret in base32 and the URI `otpauth://totp/equori:<email>?secret=<secret>&issuer=equori`, and stores an unconfirmed row, replacing an unconfirmed one. A confirmed row is 409 `totp_enabled`. `POST /api/v1/me/totp/confirm` with `{code}` confirms it; a wrong code is 422 `totp_code_invalid`. `POST /api/v1/me/totp/disable` with `{password}` deletes it; a wrong password is 403 `password_invalid`. | Confirmation proves the app holds the secret before login depends on it. The password on removal keeps a stolen session from removing the factor. |
| HA36 | The web draws the QR code of the URI from the module matrix of the library `uqr` (MIT, no dependencies) and shows the secret in groups of four characters beside it. ADR 030 records the dependency. | Owner decision of 2026-10-30: a QR code with an ADR. Drawing the matrix as SVG elements avoids inserting HTML. The text secret serves an app without a camera. |

### 4.8 Recovery codes

| ID | Decision | Reason |
|---|---|---|
| HA37 | Enabling the first second factor (TOTP confirmed or first passkey) generates 10 recovery codes, returned once, and deletes the member's other sessions. Removing the last factor deletes the codes. `POST /api/v1/me/recovery-codes` with `{password}` replaces all codes. | Codes exist only while a factor exists. Deleting other sessions ends a session opened by someone who knew only the password. |
| HA38 | A code is 16 base32 characters, shown as four groups of four. Table `identity_recovery_code`: `member_id bigint NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE`, `code_hash bytea NOT NULL`, `created_at timestamptz NOT NULL`, `PRIMARY KEY (member_id, code_hash)`. The hash is SHA-256; a used code is deleted. | 80 bits make an offline search of a leaked hash infeasible, so argon2id is not needed and a login with a code takes no hash slot (ADR 003). |
| HA39 | `GET /api/v1/me/second-factor` returns `totp` (boolean), `passkeys` (`id`, `name`, `created_at`, `last_used_at`) and `recovery_codes_left`. | One answer feeds the security screen. |

### 4.9 Passkeys

| ID | Decision | Reason |
|---|---|---|
| HA40 | A passkey is a second factor, never a login without password. | Section 9.4.1 names passkeys as a second factor; ADR 003 keeps the password as the first factor. |
| HA41 | WebAuthn with attestation `none`, algorithms ES256 (-7), EdDSA (-8) and RS256 (-257), user presence required, user verification `preferred`. At registration the web sends `clientDataJSON`, `getAuthenticatorData()`, `getPublicKey()` (SPKI DER) and `getPublicKeyAlgorithm()`. The server checks the client data (type, challenge, origin), the RP ID hash and flags of the authenticator data, reads the credential ID from the attested credential data, and parses the key with `crypto/x509`. Assertions are verified with `crypto/ecdsa`, `crypto/ed25519` and `crypto/rsa`. No dependency is added. | With attestation `none` and the SPKI key from the browser, no CBOR decoding is needed, so the standard library covers the protocol (CONTRIBUTING, Code). User verification is optional because the password already ran. |
| HA42 | The RP ID is the host name of the request's `Origin`, and the expected origin is that `Origin`. Each passkey stores its `rp_id`; a login offers only passkeys whose `rp_id` equals the request's host name. | No public URL setting exists. `http.CrossOriginProtection` already binds `Origin` to the host (ADR 003). A passkey works only on the host where it was made, so others are not offered. |
| HA43 | Table `identity_passkey`: `id uuid PRIMARY KEY`, `member_id bigint NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE`, `credential_id bytea NOT NULL UNIQUE`, `public_key bytea NOT NULL`, `algorithm integer NOT NULL CHECK (algorithm IN (-7, -8, -257))`, `sign_count bigint NOT NULL`, `rp_id text NOT NULL`, `name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60)`, `created_at timestamptz NOT NULL`, `last_used_at timestamptz`. An assertion whose counter is not above a stored non-zero counter is refused. | Algorithms are a closed WebAuthn set, so `CHECK ... IN` applies (ADR 016, X9). A counter that goes back signals a cloned key; many authenticators always report 0. |
| HA44 | `POST /api/v1/me/passkeys/options` returns the creation options and stores the challenge in `identity_passkey_challenge` (`member_id` primary key, `challenge bytea`, `expires_at`, 5 minutes). `POST /api/v1/me/passkeys` with `{name, client_data_json, authenticator_data, public_key, algorithm}` registers it; a failed check is 422 `passkey_invalid`. `POST /api/v1/me/passkeys/{id}/remove` with `{password}` deletes one; a wrong password is 403 `password_invalid`; an unknown ID is 404 `passkey_not_found`. The user handle is 16 random bytes per registration. | The challenge must survive between two requests. A random handle carries no personal data; a second factor with `allowCredentials` never reads it. |
| HA45 | The web offers passkeys only when `window.isSecureContext` is true and `PublicKeyCredential` exists. | Browsers expose WebAuthn only over HTTPS or `localhost`; a LAN instance with `EQUORI_INSECURE_COOKIES` keeps TOTP. |

### 4.10 Login with a second factor

| ID | Decision | Reason |
|---|---|---|
| HA46 | `createSession` keeps 204 for a member without a second factor. For a member with one it answers 202 with `{methods, passkey}` and sets the cookie `equori_login` (HttpOnly, `SameSite=Lax`, `Path=/api/v1/session`, 5 minutes). `methods` lists `totp`, `passkey` and `recovery_code` as enabled; `passkey` holds the challenge and the allowed credential IDs, or null. Table `identity_login_challenge`: `token_hash bytea PRIMARY KEY`, `member_id bigint NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE`, `challenge bytea NOT NULL`, `attempts integer NOT NULL DEFAULT 0`, `expires_at timestamptz NOT NULL`. | A distinct status keeps members without a factor unchanged. The pending token follows the session token rule; a table survives a restart and serves tests without a wall clock. |
| HA47 | `POST /api/v1/session/second-factor` (`public`) with exactly one of `totp_code`, `recovery_code`, `passkey` (`credential_id`, `client_data_json`, `authenticator_data`, `signature`) starts the session as `createSession` does (HA3), deletes the pending row and clears `equori_login`. A wrong value is 401 `second_factor_invalid`. The fifth wrong value deletes the pending row; a missing or expired row is 401 `unauthenticated`. | Five attempts per pending login and five password attempts per email in 15 minutes (ADR 003) allow 25 guesses per 15 minutes; with 3 valid TOTP codes in 10^6, the chance is at most 7.5 × 10^-5 per 15 minutes, and only for a holder of the password. |
| HA48 | The login log line names the method: `password`, `totp`, `passkey` or `recovery_code`. A used recovery code logs the count left. | The owner sees how a session started (ADR 003, login logging). |
| HA49 | `equori user reset-second-factor --email <email>` deletes the member's TOTP, passkeys, recovery codes, pending logins and sessions. | A member who lost every factor regains access through the host operator, the same trust root as the setup token (ADR 003, amendment of 2026-10-27). |
| HA50 | Access tokens keep working after a second factor is enabled. | A token is created inside a session; MCP clients cannot answer a second factor (ADR 024). |

### 4.11 Web

| ID | Decision | Reason |
|---|---|---|
| HA51 | The shell shows the active book name and a switcher when the member has two or more books; the switcher ends with "new book" (HA6). | A member with one book sees no change. |
| HA52 | Settings gain a "Members" section: the list of HA19 for every role, role change, removal and invitations for `owner`, "leave this book" for every role. | The section follows the rules of HA13. |
| HA53 | Settings gain a "Security" section: TOTP, passkeys and recovery codes (HA35 to HA45). The login page gains the second step of HA47. | Members manage their own factors. |
| HA54 | A `read` member sees a persistent notice in the shell that the access is read-only. A 403 `book_role_required` shows the catalog text of that code. Write controls of existing screens stay visible. | The exit criterion is enforced at the authorization point; hiding controls on every screen is out of scope (section 10). |

### 4.12 Regions

P11 introduces no region-dependent value. A new book takes its time zone from `DefaultTimeZone` (BK18) and its base currency from `Config.DefaultCurrency` (ADR 016), as setup does.

## 5. Operations

New operations; each gets an entry in `internal/server/tool_exposure_test.go` with an exclusion.

| operationId | Method and path | `x-book-role` |
|---|---|---|
| `listMyBooks` | `GET /api/v1/me/books` | read |
| `createBooks` | `POST /api/v1/books` | read |
| `switchBooks` | `PUT /api/v1/session/books` | read |
| `listMembers` | `GET /api/v1/books/current/members` | read |
| `updateMember` | `PATCH /api/v1/books/current/members/{memberId}` | owner |
| `removeMember` | `DELETE /api/v1/books/current/members/{memberId}` | owner |
| `leaveBooks` | `DELETE /api/v1/books/current/membership` | read |
| `listInvitations` | `GET /api/v1/books/current/invitations` | owner |
| `createInvitation` | `POST /api/v1/books/current/invitations` | owner |
| `deleteInvitation` | `DELETE /api/v1/books/current/invitations/{id}` | owner |
| `previewInvitation` | `POST /api/v1/invitations/preview` | public |
| `acceptInvitation` | `POST /api/v1/invitations/accept` | public |
| `completeSecondFactor` | `POST /api/v1/session/second-factor` | public |
| `getSecondFactor` | `GET /api/v1/me/second-factor` | read |
| `startTotp` | `POST /api/v1/me/totp` | read |
| `confirmTotp` | `POST /api/v1/me/totp/confirm` | read |
| `disableTotp` | `POST /api/v1/me/totp/disable` | read |
| `createPasskeyOptions` | `POST /api/v1/me/passkeys/options` | read |
| `createPasskey` | `POST /api/v1/me/passkeys` | read |
| `removePasskey` | `POST /api/v1/me/passkeys/{id}/remove` | read |
| `regenerateRecoveryCodes` | `POST /api/v1/me/recovery-codes` | read |

New `Problem.code` values, each with an HTTP test (CONTRIBUTING, Tests): `book_role_required` (403), `books_not_found` (404), `member_not_found` (404), `last_owner` (409), `already_member` (409), `invitation_not_found` (404), `invitation_email_mismatch` (403), `totp_enabled` (409), `totp_code_invalid` (422), `password_invalid` (403), `passkey_invalid` (422), `passkey_not_found` (404), `second_factor_invalid` (401).

## 6. Scenarios

| ID | Scenario |
|---|---|
| S192 | For each of `read`, `write` and `owner`: a `GET` operation answers 200; a `write` operation answers 403 `book_role_required` for `read` and succeeds for `write` and `owner`; an `owner` operation answers 403 for `read` and `write` and succeeds for `owner`. |
| S193 | A member switches to a book of another member without a membership: 404 `books_not_found`. A resource ID of that book read from the member's session: 404. |
| S194 | An owner invites an email without a member as `write`; acceptance with a password creates a member with instance role `member`, and its session reads the inviting book. |
| S195 | A member with a book accepts an invitation to a second book; `listMyBooks` returns both with `active` on the second; a switch to the first and a new login open the first. |
| S196 | The only owner demotes itself or leaves: 409 `last_owner`. |
| S197 | A member demoted from `write` to `read` keeps a `write` access token that reaches no write tool on `/mcp`; a `read` member creating a `write` token receives 403 `book_role_required`. |
| S198 | A conversation of one member is absent from the list of another member of the same book and is 404 by ID. |
| S199 | Login with TOTP: password, then the code, starts a session; the same code again after a new password step is 401 `second_factor_invalid`. |
| S200 | Login with a passkey: password, then an assertion signed by a software key registered through `createPasskey`, starts a session. |
| S201 | Login with a recovery code starts a session; `recovery_codes_left` drops by one; the same code again is 401 `second_factor_invalid`. |
| S202 | Five wrong second factors end the pending login; a sixth attempt with the right code is 401 `unauthenticated`. |

## 7. Documents changed with the code

- ADR 029: amendment with HA3, HA7, HA8 to HA13 and HA28.
- ADR 003: amendment: the login rule of HA3; an invitation creates a member (HA26); the second factor moves from "Not covered" to ADR 030.
- ADR 030 (new): second factor: TOTP, recovery codes, passkeys without a dependency, the `uqr` dependency of the web, reset by the CLI.
- ADR 024: the effective scope of HA16.
- `docs/specs/2026-10-26-export-design.md`, E2: the conversation tables of HA55 and `identity_invitation` stay out of the archive.
- `docs/specs/2026-10-30-shared-books-design.md`, section 5: the row of browser keys follows HA29 and HA30.
- `docs/domain/02-ubiquitous-language.md`: invitation, required book role, second factor, recovery code, passkey.
- `docs/domain/06-scenarios.md`: S192 to S202.
- `docs/domain/07-data-model.md`: the columns of HA1, HA2 and HA28 and the tables of HA23, HA34, HA38, HA43, HA44 and HA46.

## 8. Owner tasks

- Register a passkey on a phone and on a computer over HTTPS and log in with each.
- Enable TOTP with an authenticator app by its QR code and log in with it.
- Invite a second person to a book and check the access of each role.

## 9. Edge cases

- A membership deleted between the check of HA4 and the session update: the foreign key of BK6 fails and the answer is 404 `books_not_found`.
- An invitation accepted twice at once: the transaction deletes the invitation, so the second acceptance is 404 `invitation_not_found`.
- Two invitations of one new email, from two books, accepted at once: the unique email of `identity_member` rejects the second member; that acceptance answers 401 `unauthenticated`, as for an existing member without a session (HA26).
- A role change of a member with an open session: the next request uses the new role (HA9).
- A device whose unsuffixed keys belong to a book that is no longer the lowest `owner` book of HA31, after a promotion in another book before the first load: the values move to that other book. Accepted risk: it needs a promotion to `owner` in a book with a lower ID before the device's first load after the upgrade.

## 10. Out of scope

| Item | Phase |
|---|---|
| Hiding write controls of existing screens for a `read` member | After 1.0 |
| Offer of the second factor at first access and when remote access is set up | P14 |
| Invitation by e-mail | 1.x (section 9.4.4, notices outside equori) |
| Deleting a book | After 1.0 |
| Transfer between books, consolidated report, shared expense across books | After 1.0 (section 9.4.4) |
| Admin screens that list and disable members; password change and reset | Not planned for 1.0 (ADR 003, Deferred) |
| Login with a passkey without password; attestation verification | Not planned |
| Moving the instance-role checks of HA14 into the authorization point | Not planned |

## 11. Plans

P11 is executed in three plans, in this order (section 9.4.3):

1. Households API: HA1 to HA28 and HA55; S192 to S198; the `x-book-role` of every existing operation.
2. Households web: HA29 to HA32, HA51, HA52, HA54.
3. Second factor: HA33 to HA50, HA53, ADR 030; S199 to S202.
