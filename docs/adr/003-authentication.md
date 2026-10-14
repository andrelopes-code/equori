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
- Failed logins are throttled per email: 5 attempts per 15 minutes, in memory. The response for unknown email and wrong password is identical, and both run argon2id.

## Not covered

- Encryption of stored integration credentials (bank tokens): separate ADR before the first integration.
- Multi-factor authentication and OIDC login.
