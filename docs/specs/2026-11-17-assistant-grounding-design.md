# Grounding of the assistant's answers about equori

Amends `docs/specs/2026-10-23-assistant-chat-design.md` (the Help section of the prompt, the size of a guide article and the size of the tool catalog).

## 1. Problem

The assistant answers a question about how equori works from the article that `get_help` returns. Two facts let it answer with invented content.

| # | Fact | Effect |
|---|---|---|
| 1 | The prompt forbids figures, names, dates and IDs that no tool returned (section Data). It holds no rule for steps, screens, buttons, settings and rules of the application. | When the article does not cover the question, nothing tells the model to say so. |
| 2 | An article holds at most 3,000 bytes. On 2026-11-17, four of 25 articles sit within 30 bytes of the limit and `investments.md` holds 3,175. | Each feature that adds a sentence removes another one, chosen by its size. The article of budgets lost an example to describe the entries of a bucket. |

Owner, 2026-11-17: an assistant without enough information does not answer, or answers with invented steps; both are worse than a longer article.

## 2. Rules

### A244 Answers about equori come from the guide

The Help section of the chat prompt and of the MCP instructions holds the rule:

> State a step, a screen, a button, a setting or a rule of equori only when an article that get_help returned in this conversation states it. When no article covers the question, say that the guide does not cover it and name the closest screen get_help returned. Never invent a step, a screen or a setting.

The rule follows the Data rule in form: what the model may state, then what it does without it.

### A245 Size of an article

An article holds 200 to 6,000 bytes.

- An article enters the context only in a turn that calls `get_help` with its topic.
- 6,000 bytes are about 1,500 tokens in a turn that asks for help.
- A topic that passes the limit is split into two topics, each with its screens in the navigation map.

### A247 Size of the tool catalog

The catalog of tools holds at most 72,000 bytes; a declaration keeps its 3,500.

- The catalog held 63,994 of 64,000 bytes on 2026-11-17. The topic `income_split` of `get_help` adds 15 bytes and no longer fits. The versions of the income split dropped two inputs of `save_buckets` for the same reason.
- The catalog enters every turn. 8,000 bytes are about 2,000 tokens a turn, which a provider with prompt caching bills at the cached rate after the first turn of a conversation.
- A limit reached within 0.01% makes each new input remove an existing description by its size. The new limit leaves 11% of room.

### A246 Topic of the income split

The income split leaves the article `budgets` and gets the topic `income_split`.

- The article states: what a bucket is and how it counts; the presets; the bucket of a category and of a subcategory; versions and the field Valid from; End split; the History dialog; the Plan view; the Track view with the strip of six months and the mark of a change; the entries of a bucket.
- `budgets` keeps one sentence that names the income split and its topic, and gets back the sentences it lost to the limit.
- The navigation map lists `income_split` on the screens that list `budgets` and on the categories screen.
- The guide holds 26 topics.

## 3. Cross-cutting questions

- R1: Does not apply: no value varies by country.
- R2: Does not apply: no regional value.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: Does not apply: the prompt and the articles are English text for the model; the model answers in the user's language.
- R6: Does not apply: no number or date is written on a screen.
- C1: Does not apply: no amount.
- C2: Does not apply: no amount.
- C3: Does not apply: no amount.
- C4: Does not apply: no amount.
- T1: Does not apply: no date.
- T2: Does not apply: no business day.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: No operation. The enum `topic` of `get_help` gains `income_split`; the catalog limit is the one of A247.
- S2: Does not apply: no screen changes.
- S3: The articles `budgets` and `income_split` change in this change.
- S4: The assistant reads the new topic through `get_help`.
- X1: Does not apply: no scenario of `docs/domain/06-scenarios.md`; the prompt text and the topic list have unit tests.
- X2: Does not apply.

## 4. Tests

- The chat prompt and the MCP instructions hold the sentence of A244 (`internal/assistant/app/prompt_test.go`, fixture `testdata/prompt_pt_BR.txt`).
- `TestArticlesExist` expects 26 topics of 200 to 6,000 bytes.
- `TestToolCatalogQuality` allows 72,000 bytes.
- The navigation map test accepts `income_split` on its screens.
- The effect on answers is measured by the tests with the build tag `eval`, which the owner runs with a provider key.
