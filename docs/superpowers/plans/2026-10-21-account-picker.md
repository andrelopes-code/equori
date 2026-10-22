# Account picker with consequences and institution logos

Branch `feat/account-picker`, worktree `../equori-account-picker`. Decisions of 2026-10-21: logos from `logos-bancos-br` bundled in the binary; statement placement computed by a new ledger operation; groups CONTAS (checking, cash, wallet, benefit, receivable, loan, payable), CARTÕES (credit_card), RESERVAS (savings, reserve, brokerage); the mark never draws `Account.icon`.

## Slice A — institution ISPB (backend)

1. ADR `docs/adr/013-institution-logos.md`: dependency `logos-bancos-br` (pinned), PNG assets bundled by Vite and embedded by `web/embed.go`, no runtime CDN, trademark disclaimer, logo resolved from `Institution.ispb`.
2. Migration `00034_ledger_institution_ispb.sql`: `ispb text CHECK (ispb ~ '^[0-9]{8}$')`, unique per `(user_id, ispb)`. Schema test violating both constraints.
3. `InstitutionInput.ispb` (optional, pattern `^[0-9]{8}$`) through domain, app, postgres, httpapi; `make gen`; apitest: create with ISPB, list returns it, duplicate ISPB returns its problem code.

## Slice B — statement placement (backend)

4. `GET /accounts/{id}/statement-placement?date=` returns `{reference, closing_date, due_date}` of the statement a purchase on `date` is billed on, with the dates adjusted by the rule's calendar. Problem codes: not a card (existing), no billing rule in force. Domain test table, apitest per problem code, entry in `internal/server/tool_exposure_test.go`.

## Slice C — web rules

5. `web/package.json` adds `logos-bancos-br` (exact version). `features/accounts/institution-logo.ts`: ISPB → bundled PNG URL through `import.meta.glob`, affiliates resolved to the shared file. Test: known ISPB returns a URL, unknown returns `undefined`.
6. `features/transactions/account-consequence.ts`: pure function from (account, balance, free limit, placement, goal, amount, kind) to a consequence or `null`. Table tests per rule of the spec, including the missing-data cases.
7. `features/transactions/account-groups.ts` (fixed group order, kind mapping, collator order inside a group) and `account-suggestion.ts` (most used account in the last 10 transactions of the category or payee, threshold 60 %). Table tests.

## Slice D — web components

8. `features/accounts/account-mark.tsx` (+ css): square, card 1.586:1, circle with goal ring; sizes sm, md, lg; logo with `object-fit: contain`; monogram over `--slotted-data-n`; disabled state; `aria-hidden`. Tests.
9. `features/transactions/account-option.tsx` and `account-option-list.tsx`: `role="radio"` inside `role="radiogroup"`, roving focus, the five states. Tests for keyboard and `aria-checked`, disabled reason in text.
10. `features/transactions/account-field.tsx`: trigger, consequence sentence (`role="status"`, `aria-describedby`), phone sheet with search and groups, wide grid. Replaces `AccountPicker` in `transaction-form.tsx`; catalog keys in both languages. Tests in `new-transaction-page.test.tsx`.

## Verification

`make check-commit` after each slice; `make check` at the end.

## Later plans of the same owner request

- Category from the description: a rule or a suggestion fills the category while the description is typed.
- Natural-language entry: one or more transactions recorded from a sentence.
- An account and institution screen with an institution chooser fed by the `logos-bancos-br` catalogue, and the sheet's "Adicionar conta ou cartão" button pointing to it.
