# ADR 031: Encrypted copy format

- Status: accepted
- Date: 2026-10-31
- Design: `docs/specs/2026-10-31-protected-data-design.md`, A155

## Context

The encrypted copy leaves the data disk. The project writes no encryption format of its own.

## Decision

- The copy uses age v1 (`age-encryption.org/v1`) with the scrypt recipient of the copy password, through `filippo.io/age v1.3.2`.
- The file is named `<backup file name>.age` and has mode 0644.
- `age -d` or `equori restore` opens the file.

## Consequences

- One new dependency enters `go.mod`.
- A lost copy password makes the copies written under it unreadable.
- The instance secret key is not in the copy (K2 of ADR 008).
