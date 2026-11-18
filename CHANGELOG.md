# Changelog

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Each release also carries notes generated from its Conventional Commits on the [releases page](https://github.com/andrelopes-code/equori/releases).

## [Unreleased]

### Added

- One account serves several goals by amount: a goal holds an account whole or a part of it, with Set aside and Release on its card, and a schedule can set each occurrence aside for a goal.
- A goal pays an expense: linked on the transaction or on the goal's card, or paid from the goal's own account. The expense counts against neither the budget nor the bucket of its category.
- The Plan lists earlier installments, scheduled savings and goal deposits beside the buckets; the Track view draws where the month's income went.
- The contribution plan offers the amount the month plan already sends to the brokerage and marks the assets a goal holds.

### Changed

- Planning counts money set aside by where it goes, not by the kind of its schedule (planning coherence A250 to A254). The figures of months already closed change, with no stored row changed, for a book that holds: a transfer schedule into a savings or goal account, a savings schedule into a goal account, an expense paid from a savings or goal account, an income credited to one, a budget that carries its balance, or a withdrawal from a goal. A yield that stays in the investments leaves the income received; a bucket is judged without what an accumulated budget balance or a goal paid; the goals bucket is judged on its deposits.
- The agenda counts a transfer into savings, a brokerage or a goal as an outflow of the month, and the way back as an inflow.
- `POST /goals` with an empty `account_ids` answers 422 instead of 400; a goal now holds at least one account across `account_ids` and `allocated_account_ids`.
- The archive version is 28.

## [0.1.0-beta.1] - 2026-11-04

### Added

- Ledger with accounts, transactions, postings and reconciliation.
- Credit cards with statements, installment plans and a cash view of card spending.
- File import (OFX, CSV) with deduplication, matching and classification rules.
- Pluggy synchronization through Meu Pluggy.
- Planning: schedules, budgets, goals and projections.
- Currencies and investments: instruments, prices, trades, income and positions.
- Reports, text capture and an assistant over the application's tools, also served through MCP.
- Export and import of the books as a versioned archive.
- Distribution as a container image, archives for Linux and macOS, a Homebrew formula and a Windows installer.
- Web interface embedded in the binary.

[Unreleased]: https://github.com/andrelopes-code/equori/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/andrelopes-code/equori/releases/tag/v0.1.0-beta.1
