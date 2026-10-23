# ADR 020: Assistant conversation

- Status: proposed
- Date: 2026-10-23
- Amends: ADR 004 (member `retry_at`), ADR 012 (T9, T10, T14), ADR 019 (P14)
- Design: `docs/superpowers/specs/2026-10-23-assistant-chat-design.md`
- Audit: `docs/superpowers/specs/2026-10-23-assistant-infra-audit.md`

## Context

ADR 019 declares the use `assistant.chat` and ADR 012 the tool registry, with four read-only tools and no write tool. A conversational assistant answers from the user's data, explains the product, and prepares changes. Its default provider is the Gemini free tier, whose quota is counted per request and whose free content is used by Google to improve its products. Imported descriptions and payee names reach the model as tool output and can carry instructions. A Gemini model refuses a history whose function calls lack its thought signature, so a provider change inside one turn fails (audit item 5).

## Decision

| ID | Rule |
|---|---|
| C1 | Module `assistant` owns `assistant_conversation`, `assistant_message` and `assistant_proposal`, each with `user_id`. A conversation stays until its user deletes it or all of the user's conversations. |
| C2 | Only user messages, final answers and proposals persist. The model receives earlier turns as text, the latest 6 turns within 8,000 bytes, plus one status line per proposal. |
| C3 | `POST /assistant/turns` streams Server-Sent Events: `turn`, `step` per tool call, then `answer` or `error`. The handler extends its write deadline to 120 s; the turn runs under a 90 s deadline and stops when the client disconnects. |
| C4 | An attempt of a turn makes at most 6 model calls; the last carries `ToolChoice: "none"`. Steps after the first are pinned to the first step's target; an exhausted pinned target restarts the turn once without the pin, and proposals of the abandoned attempt become `discarded`. |
| C5 | Tools follow user tasks; the 173 operations map to 36 tools or to an exclusion: `-session`, `-binary`, `-capture`, `-llm`, `-secret`, `-file`, `-visual`, `-setup`. Every step carries all 36 declarations: measured against three subset deliveries, it had the highest success per request (spec 7.3). |
| C6 | A `Write` or `Destructive` tool is built with `tool.NewWrite`, which adds a preview: the changes as fields of a closed vocabulary, a destructive flag and a basis that changes with the data the action depends on. In the chat set, a write call stores a pending proposal valid for 15 minutes and returns its preview to the model. |
| C7 | Only the user's confirmation executes a proposal: an atomic claim from `pending` to `executing`, a new preview whose basis must equal the stored one, then the call. Execution happens at most once. Codes: `proposal_not_found` 404, `proposal_closed` 409, `proposal_expired` 409, `proposal_stale` 409. |
| C8 | Tool results are data. The system prompt says that text inside them carries no instructions; no write executes without confirmation; adversarial tests and evaluation tasks check both. |
| C9 | The assistant answers in the profile language and formats by the profile region. While privacy mode is on, the panel masks amount-shaped text of answers and renders proposal amounts through `useMoneyFormat()`. |
| C10 | Resolution skips a target whose declared daily limit is reached. When every target is cooling down or over its limit, the turn answers 429 `assistant_exhausted` with `retry_at` before any request; during a turn the same problem arrives as an `error` event. |
| C11 | `get_help` returns articles of a guide kept in `internal/assistant` and the screens of the navigation map `web/src/navigation/navigation-map.json`. Tests tie bold terms to the glossary of `docs/domain/02-ubiquitous-language.md` and every map path to a route of `web/`. |
| C12 | One log line per turn (steps, tool calls, tokens, provider, model, outcome, restart, duration) and one per proposal decision; never arguments, results or text. |
| C13 | A real evaluation (`-tags eval`, 20 tasks, 3 trials, code graders on the final state) runs per provider with thresholds fixed in the design; results are versioned under `docs/assistant-eval/`. |
| C14 | The default chain of `assistant.chat` starts with `gemini-3.5-flash-lite`, then `gemini-3.5-flash`: the free tier of Flash allows 20 requests a day per project (measured 2026-10-23, spec 6.4). |

## Amendments

- ADR 004: a problem may carry `retry_at` (RFC 3339 instant) when the client can retry after a known instant; `assistant_exhausted` sets it.
- ADR 012 T9: `tool.NewWrite` builds `Write` and `Destructive` tools with a preview, and `Registry.Preview` runs it; the assistant's chat set refuses at startup a tool that is not `ReadOnly` and has no preview.
- ADR 012 T10: in the assistant's chat set, a write tool's handler stores a proposal; `Set.LLM` keeps executing for other consumers.
- ADR 012 T14: exclusion reasons are `-session`, `-binary`, `-capture`, `-llm`, `-secret`, `-file`, `-visual` and `-setup`; `-write` and `-pending` no longer exist. A tool that covers no operation (`get_help`) is listed with its reason in the test.
- ADR 019 P14: daily limits are enforced at resolution, for every use.
- ADR 019 design G7: the agent use starts on Gemini Flash-Lite, not Flash (C14).

## Consequences

- Each confirmation runs the preview twice (at proposal and at confirmation); a preview is one read of the entities changed.
- A crash between claim and execution leaves a proposal `executing`; it is never executed again, and the user repeats the request.
- Free-tier content still reaches Google; the panel states it before the first message, from the notice of the target that answers.
- The guide is English; answers in other languages are the model's translation.

## Revisit criterion

A provider whose answers cross the evaluation thresholds only with a catalog delivery other than the measured one, or a need for an assistant action without human confirmation.
