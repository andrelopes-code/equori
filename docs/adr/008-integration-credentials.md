# ADR 008: Integration credentials

- Status: accepted
- Date: 2026-10-16

## Context

Phase P6 stores Pluggy client ids and secrets. Each pair reads every bank item of its Pluggy application, so a leaked database dump or backup must not reveal it (N15). ADR 003 left this decision open ("Not covered"). A user may hold several pairs (P6 amendment A34).

## Decision

| ID | Rule |
|---|---|
| K1 | Credentials are sealed with AES-256-GCM (`internal/platform/secret`, standard library only). A sealed value is a format byte, the first 4 bytes of SHA-256 of the key, a random 12-byte nonce and the ciphertext with its tag. |
| K2 | The key is 32 bytes from `EQUORI_SECRET_KEY` (standard base64), outside the database and outside backups. Without it, integration endpoints return 409 `integration_unavailable`; every other feature works. |
| K3 | Associated data binds a value to its row: table name, user id and row id. A value copied to another row, or a relabelled key id, does not open. Any failure is the same error, `ErrUnreadable`. |
| K4 | Rotation: the new key goes to `EQUORI_SECRET_KEY` and the old one to `EQUORI_SECRET_KEY_PREVIOUS`; `equori secrets rotate` reseals every value in one database transaction; then the previous key is removed. |
| K5 | Plaintext credentials and the Pluggy API keys derived from them live only in memory, never in logs, problem details or responses (N16). |
| K6 | Amendment of 2026-10-26. In managed mode without `EQUORI_SECRET_KEY`, the first start writes 32 random bytes in standard base64 to `secret.key` in the data directory, mode 0600, outside every dump; `equori secrets key` prints the key in use. Reason: a Homebrew service or a standalone container has no place for a key the owner would have to generate first (ADR 022, C3). |

## Consequences

- Losing the key loses the stored credentials only: the owner enters them again; ledger data is unaffected.
- A backup restored on another host needs the same key to keep integrations working (`docs/operations/backup.md`).
- The database alone cannot decrypt credentials; a host compromise that reads the process environment can.

## Revisit criterion

Support for a key management service, or more than one person administering the instance.
