# ADR 030: Second factor

- Status: accepted
- Date: 2026-10-31
- Design: `docs/specs/2026-10-30-households-access-design.md`, HA33 to HA50 and HA53

## Context

ADR 003 leaves multi-factor authentication out. Version 1.0 serves several members per instance and remote access, where a password alone opens a book's data. Go has no TOTP or WebAuthn dependency in `go.mod`, and the web has no QR code library.

## Decision

- A member may enable TOTP (RFC 6238, SHA-1, 6 digits, 30-second step, one step of window) and passkeys. Either one makes the login ask for a second factor after the password; the password stays the first factor.
- The TOTP secret is sealed with the secret box of ADR 008; the last accepted step is stored, so a code is accepted once. Without `EQUORI_SECRET_KEY` TOTP is unavailable (409 `secret_key_missing`); `equori secrets rotate` reseals the secrets.
- Passkeys use WebAuthn with attestation `none`. The browser sends the SPKI public key, so the server verifies registrations and assertions with `crypto/x509`, `crypto/ecdsa`, `crypto/ed25519` and `crypto/rsa`; no Go dependency is added. The RP ID is the host name of the request's `Origin`.
- Enabling the first factor returns 10 single-use recovery codes, stored as SHA-256, and ends the member's other sessions. Removing the last factor deletes the codes.
- A correct password of a member with a factor opens a pending login of 5 minutes and five attempts, held in `identity_login_challenge` and the cookie `equori_login`.
- The web draws the TOTP QR code with `uqr` (MIT, no dependencies), as SVG elements.
- A member who lost every factor is reset by the host operator: `equori user reset-second-factor --email <email>`.
- Access tokens keep working after a factor is enabled; MCP clients cannot answer a second factor (ADR 024).

## Consequences

- A leaked database yields no TOTP secret and no recovery code.
- A restore into an instance with another key leaves TOTP unreadable; recovery codes, passkeys and the CLI reset still open the account.
- A plain-HTTP LAN instance offers no passkeys, because browsers expose WebAuthn only in a secure context.
