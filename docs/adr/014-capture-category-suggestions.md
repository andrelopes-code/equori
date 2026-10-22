# ADR 014: Category suggestions from a language model

- Status: accepted
- Date: 2026-10-21

## Context

Text capture (`docs/superpowers/specs/2026-10-21-text-capture-design.md`) decides categories with classification: aliases, rules and payee history (F5). A description that none of them knows, such as the first purchase at a new shop, stays uncategorized. A language model names a category for most such descriptions. The Gemini API free quota (ADR 009) is counted in requests per minute and per day, and the capture preview runs on every pause in typing.

## Decision

| ID | Rule |
|---|---|
| L1 | The model is asked only for capture lines of kind expense or income, with a description, an account and an amount, that classification left without a category. A line with an issue is not asked. |
| L2 | The request carries the line descriptions, each with its class, and the paths of the owner's open categories (`Food › Supermarket`) numbered by position. Amounts, dates, accounts, payees and identifiers are never sent. |
| L3 | The answer is one category number per description, constrained by a response schema; a number outside the list or of the other class is no suggestion. The model never writes an identifier, so a description that carries instructions cannot change what is recorded beyond the choice of a listed category. |
| L4 | Answers are kept in `capture_category_hint` per user, class and normalized description. A kept category is served without a call while it is open and of the class; a kept "none" is served for 30 days. The same description therefore costs at most one call. |
| L5 | One request covers at most 40 descriptions. The client asks after the text has been still for 1.2 seconds, so a pause inside a word is not a request. |
| L6 | The chain is `aistudio/gemini-3.5-flash-lite`. Without a configured provider, or while every target cools down, the endpoint answers `available: false` with the kept hints and the screen keeps the drafts uncategorized. |
| L7 | A suggestion is shown as such on its draft and recorded as the category of the transaction unless the owner changes it. A recorded category feeds payee history and rule suggestions (S42), so a description the owner keeps recording stops reaching the model. |

## Consequences

- On unpaid quota, Google may use submitted content and human reviewers may read it (ADR 009). Configuring `EQUORI_GEMINI_API_KEY` is the owner's consent to sending descriptions and category names.
- Hints of a category the owner later merges or closes are asked again.
- New table `capture_category_hint`, owned by `capture`.

## Revisit criterion

A paid quota, which would allow asking on every preview, or a local model.
