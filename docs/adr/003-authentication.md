# ADR 003: Local password authentication with server-side sessions

- Status: accepted
- Date: 2026-10-14

## Context

An instance holds financial data of several users, for example the members of one household. Each user sees only their own data. Self-hosters do not always run an authenticating reverse proxy.

## Decision

### Users and data isolation

- Module `identity` owns users and sessions (tables `identity_user`, `identity_session`).
- Every business table has `user_id bigint NOT NULL REFERENCES identity_user(id)`. Every query on a business table filters by `user_id`.
- The authenticated user ID reaches `app` as an explicit parameter, never through a global.
- Roles: `admin` and `member`. An admin creates and disables users. Nobody can self-register.
- The first admin is created with the CLI: `equori user create --admin --email <email>`; the password is read from stdin. No HTTP setup endpoint exists, so an exposed instance cannot be claimed by a third party before setup.

### Passwords

- argon2id (`golang.org/x/crypto/argon2`) with OWASP parameters: 19 MiB memory, 2 iterations, parallelism 1, 16-byte salt.
- Stored in PHC string format, so parameters can change without a migration.
- Minimum length 12 characters. No composition rules.

### Sessions

- Token: 32 random bytes (`crypto/rand`), base64url in the cookie.
- The database stores the SHA-256 of the token, never the token. A leaked database does not yield usable sessions.
- Absolute expiry 30 days. Logout and password change delete the user's sessions.
- Cookie `equori_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` unless `EQUORI_INSECURE_COOKIES=true`. The flag exists for plain-HTTP LAN deployments, where browsers drop `Secure` cookies.

### Request forgery and brute force

- `http.CrossOriginProtection` (stdlib, Go 1.25+) rejects cross-origin non-safe requests using `Sec-Fetch-Site` and `Origin`. It is part of `httpserver.Middleware`.
- Login attempts are counted per email: 5 per 15 minutes, in memory. The count is checked and incremented under one lock before the password is verified, so concurrent requests cannot exceed it. A successful login clears it.
- The response for unknown email and wrong password is identical, and both run argon2id.
- Concurrent argon2id runs are capped at the CPU count (19 MiB each). A request waits at most 5 s for a slot, then receives 503 `server_busy`.
- Request bodies are capped at 1 MiB (`httpserver.Middleware`).
- Successful and failed logins are logged (`login succeeded` with user ID, `login failed` with email and reason).
- Known limit: a third party who knows an email can keep that account throttled. A per-IP limit requires a trusted-proxy setting and is not implemented.

## Deferred

The instance has one user until further notice. Data stays isolated by `user_id`, so more users need no migration. Deferred until a second user exists:

- Admin endpoints to create and disable users (the CLI creates users meanwhile).
- Password change endpoint (must delete the user's sessions and personal access tokens).
- Per-IP login limit (requires a trusted-proxy setting).

## Not covered

- Encryption of stored integration credentials (bank tokens): separate ADR before the first integration.
- OIDC login. Multi-factor authentication moved to ADR 030.

## Amendment of 2026-10-27 (ADR 023)

The first admin is also created from the browser. "No HTTP setup endpoint exists" no longer holds:

- While no user exists, `serve` issues a one-time setup token of 32 random bytes and logs the URL `/setup#token=<token>`; in managed mode it also writes the URL to `setup.url` in the data directory. Reading the token requires the host: the log or the data directory.
- `GET /api/v1/setup` reports whether the setup is required. `POST /api/v1/setup` creates the first user, an admin, with the token, and starts its session. Another token is 403 `setup_token_invalid`; an existing user is 409 `setup_complete`. The creation locks `identity_user`, so two requests yield one admin.
- `equori user create` keeps working.

## Amendment of 2026-10-27 (ADR 024, design 2026-10-26 X5-X13)

Personal access tokens open the MCP endpoint, and only it:

- `identity_access_token` holds `id`, `user_id`, `name`, `scope` (`read` or `write`), the SHA-256 `token_hash`, `created_at`, `expires_at` and `last_used_at`. The token text is `eqt_` and 32 random bytes in unpadded base32; the API shows it once, in the answer of `createAccessToken`.
- Expiry is chosen at creation: 30, 90 or 365 days. `last_used_at` is written at most once a minute per token. Deleting a token takes effect on the next request.
- `/mcp` accepts only `Authorization: Bearer <token>`; a token in the query string is never read; the session cookie is not accepted there, and a token is not accepted on `/api/`.

## Amendment of 2026-10-30 (ADR 029)

[ADR 029](029-shared-books.md) replaces the section "Users and data isolation":

- The person who logs in is a member (`identity_member`); business data belongs to a book (`identity_books`); `identity_membership` links one member to one book with a book role.
- A session and an access token belong to a membership: `identity_session` and `identity_access_token` hold `member_id` and `books_id`, and deleting the membership deletes them.
- Login opens the session in the book of the member's `owner` membership with the lowest `books_id`, else the lowest `books_id` of any membership; a member without membership gets `invalid_credentials`.

## Amendment of 2026-10-30 (P11, households)

A login opens the membership with the latest `last_active_at`, ties broken by the lowest books ID; this replaces the login sentence of the amendment of 2026-10-30 (ADR 029). An owner invites an email to a book with a single-use token valid for 7 days; when no member has the email, its acceptance creates a member with instance role `member` and the given password and language. Self-registration stays impossible: acceptance needs a token.

## Amendment of 2026-10-31 (ADR 030)

A member with TOTP or a passkey finishes a login with a second factor (ADR 030). A right password of such a member does not clear the attempt count of the email; the right second factor clears it. The login log line names the method: `password`, `totp`, `passkey` or `recovery_code`.
