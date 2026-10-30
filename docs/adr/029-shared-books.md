# ADR 029: Shared books

- Status: accepted
- Date: 2026-10-30
- Replaces: the section "Users and data isolation" of ADR 003
- Design: `docs/specs/2026-10-30-shared-books-design.md`

## Context

ADR 003 gives every business table a `user_id`, which names both the person who logs in and the owner of the data. Version 1.0 lets several people share one set of data with separate logins (`docs/domain/09-roadmap.md`, section 9.4.1). Systems that added a tenant late paid for a second migration of every table and for moving preferences between person and tenant (`tmp/ideas.md`, section 07). The instance of the owner has one user per set of data, so a backfill is 1:1.

## Decision

- A book (`identity_books`) is the tenant: every business row belongs to exactly one book. Every business table has `books_id bigint NOT NULL REFERENCES identity_books (id)`, and every query on it filters by `books_id`.
- A member (`identity_member`) is a person who logs in. A membership (`identity_membership`) links one member to one book with the role `owner`, `write` or `read`.
- The instance roles `admin` and `member` of ADR 003 stay on the member.
- A session and an access token belong to one membership: they carry the member and the active book.
- `auth.MustBooksID(ctx)` and `auth.MustMemberID(ctx)` are the only sources of the book and the member in `app`; both are passed explicitly.
- A transaction belongs to one book. Data shared between books is a copy in each book, linked by a cross-book link (after 1.0).
- Each setting has one level: environment, instance, book, member or browser. A new setting names its level in the change that adds it.

## Consequences

- Backfilled books keep the IDs of the former users, so sealed values (ADR 008, K3) and composite keys stay valid without a rewrite.
- The time zone becomes a setting of the book; ADR 005, section 3 changes with the code.
- P11 adds invitations, the switch of the active book and the enforcement of book roles without a migration of business tables.
