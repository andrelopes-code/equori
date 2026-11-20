# Assistant model choice

- Status: accepted
- Date: 2026-11-20
- Amends: ADR 020 (C3, C10)

## Problem

The chat of the assistant resolves its targets from the chain of the use `assistant.chat` (ADR 019 P6) and always starts on the first usable one. A book with two models in the chain, such as `claude-haiku-5-5` and `claude-sonnet-5-5`, has no way to send one message to the second model without reordering the chain in Settings, which changes every later turn of every member.

## Decisions

| ID | Rule |
|---|---|
| MC1 | `GET /assistant/chat` returns `targets`: the resolved targets of `assistant.chat` for the book, in chain order, each with `provider_id`, `provider_name`, `model` and `notice`. A target over its daily limit is absent (ADR 019 P14); a target in cooldown is present while another target is usable. |
| MC2 | `POST /assistant/turns` takes an optional `target` (`provider_id`, `model`). With it, every resolution of `assistant.chat` inside the turn returns that target alone. Without it, resolution is unchanged. |
| MC3 | A chosen target never falls back to another. When it is in cooldown or over its limit, the turn answers 429 `assistant_exhausted` with the `retry_at` of that target, before any request (C10). A turn therefore answers with the model the member chose, and no message needs to record its model. |
| MC4 | A `target` that is not among the targets of MC1 answers 422 `assistant_target_unknown` before the stream starts and stores no message. |
| MC5 | The choice is a browser setting (feature design B3): the panel keeps it in `localStorage` under `equori.assistant.target` and sends it on each turn. A stored choice absent from `targets` is read as no choice. |
| MC6 | The composer shows a menu of models when `targets` holds two or more entries: `Automatic` (the chain order) and one radio item per target, labeled by the model and described by the provider name. With fewer than two targets the menu is absent. |
| MC7 | The provider notice of the panel (ADR 019 P3) is the notice of the chosen target; without a choice, the notice of the first target. |
| MC8 | Earlier turns reach any model as text (C2), so a conversation may change model between turns. |

## Cross-cutting questions

- R1: Does not apply: the feature has no regional value.
- R2: Does not apply: the feature has no regional value.
- R3: Does not apply: `provider_id` and `model` are free strings of the existing chain, not a value set.
- R4: Does not apply: no extension point.
- R5: `assistant.model.title`, `assistant.model.label`, `assistant.model.automatic`, `assistant.model.automaticHint` and `problem.assistant_target_unknown`, each in pt-BR and en.
- R6: Does not apply: the menu writes no number or date.
- C1: Does not apply: no amount.
- C2: Does not apply: no amount.
- C3: Does not apply: no amount.
- C4: Does not apply: no amount.
- T1: Does not apply: no date beyond the existing `retry_at`.
- T2: Does not apply: no business day.
- B1: Does not apply: no table.
- B2: No new operation. Both operations keep `x-book-role: read`; a member of any role chooses among the targets of the book.
- B3: The choice lives in the browser (MC5). The chain stays a book setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: the model writes only proposals, as before (C7).
- D5: Does not apply: the diagnostic file is unchanged.
- S1: No new operation; `assistant_target_unknown` has an HTTP test. The assistant operations stay excluded from tools (ADR 019 P10).
- S2: The menu sits in the composer of the panel and of the drawer, so it appears on a phone.
- S3: The guide article `privacy_and_the_assistant.md` states the menu.
- S4: Does not apply: the model does not read or change its own choice (`-llm`).
- X1: S660 (a chosen target answers the turn), S661 (a chosen target in cooldown is not replaced), S662 (an unknown target is refused).
- X2: Does not apply: R1, R2, C2 and C3 do not apply.
