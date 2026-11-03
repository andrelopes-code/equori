# Assistant inference

Amends `2026-10-23-assistant-chat-design.md` (sections 5.3, 6.2, 6.4, 7.2, 7.4, 8.2, 10, 12, 13.2) and ADR 020. Owner request of 2026-11-03: the assistant follows orders literally, proposes one plain entry per request, and does not infer subscriptions, missing categories, rules or several related changes at once.

## 1. Intent

The chat assistant acts like a bookkeeper who knows the book. It does what the user asks, and it notices what the request implies: a purchase that repeats every month, a category that does not exist yet, a payee that a rule should categorize. It proposes those changes beside the requested ones, marked as suggestions with the evidence that supports them. Several changes that depend on each other arrive as one group of cards that the user confirms in order.

## 2. Goals, non-goals, anti-goals

Goals:
- IG1. A request implies changes; the assistant proposes them as suggestions, each with a one-sentence reason that names its evidence.
- IG2. A proposal can use the entity that an earlier proposal of the same conversation creates (a new category, a new transaction, a new schedule).
- IG3. Recurrence and rule evidence comes from code, not from the model's reading of raw transactions. The model receives that evidence with its own write proposals.
- IG4. A turn starts with the book's accounts, categories and schedules in context, so a literal request needs fewer tool calls.
- IG5. Inference has its own evaluation tasks, with thresholds fixed before the first run.

Non-goals:
- Proactive messages outside a turn (a notice that appears without a user message).
- Atomic execution of a group across modules. Each proposal executes in its own module transaction; ADR 005 has no transaction shared across modules.
- A list of subscription merchants. Recognition of a service by its name stays with the model (section 12).

Anti-goals:
- A suggestion executed without the user's click (chat spec 8.3 holds).
- A suggestion without evidence, or more than three suggestions in one answer.
- A suggestion that repeats a proposal the user rejected in the same conversation.
- A suggestion for a schedule or rule that already exists.

## 3. Decisions

| ID | Question | Choice | Reason |
|---|---|---|---|
| ID1 | What stops inference today | The chat prompt line "Never propose a change the user did not ask for" is replaced by the suggestion policy of section 4 | The line forbids exactly the behavior the owner asks for. |
| ID2 | How a proposal uses an entity that another proposal creates | A reference to the other proposal's ID, resolved from that proposal's stored result when it executes (section 5) | Previews read current data; an ID that does not exist yet cannot be previewed. A shared transaction across modules does not exist (ADR 005). |
| ID3 | When the user sees the preview of a dependent proposal | When its dependencies execute. Before that, the card shows the model's one-sentence summary | Every preview is computed from real data, as chat spec 8.1 requires. |
| ID4 | How "Confirm all" treats a dependent proposal | It confirms the group in order. A dependent proposal is promoted to `pending` by the server when its last dependency executes, so the next confirm of the loop finds it pending | The group was shown with its summaries; the user approved the group. A single card still needs the full preview before its own confirm. |
| ID5 | Where recurrence evidence comes from | A detector in module `planning`, served as read tool `find_recurring` and as a signal attached to write proposals (sections 6 and 7) | Small models do not infer cadence from raw lists reliably; code does it in one call. The signal reaches the model without the model deciding to look. |
| ID6 | How a schedule is tied to the transaction that starts it | `manage_schedule` action `create` gains `paid_by_transaction_id`: the occurrence on `start` is linked to that transaction | A new schedule has no occurrence ID the model can know; one argument replaces a third proposal. |
| ID7 | What the turn knows before its first call | The outputs of `list_accounts` and `list_schedules` with default arguments, in a prompt section (section 8) | Two calls that almost every write turn makes; one request of the free tier each. |
| ID8 | Step limit | 12 model calls per attempt; turn timeout 150 s; SSE write deadline 180 s | Inference turns read the series, the categories and the rules, then propose up to six changes. Six calls do not fit. |
| ID9 | Default chain order | `gemini-3.5-flash` first, then `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `groq/openai/gpt-oss-120b`, `mistral/mistral-small-latest`, `ollama/qwen3:32b` | Multi-step inference needs the larger model. When Flash reaches its daily limit (20 requests, chat spec 6.4), the router moves to Flash-Lite (ADR 019 P14). |
| ID10 | How the guide stays current | A `CONTRIBUTING.md` rule: a change to what a user can do on a screen updates the guide article of that screen's topic in the same commit | `get_help` is the assistant's only source for how-to answers, and no test detects an outdated article. |

## 4. Suggestion policy

### 4.1 Proposal metadata

Every write tool declaration of the chat set gains one optional top-level property, `proposal`. `llmapi.ChatHandlers` adds it to the input schema. The handler removes it before it calls `Service.Propose`. MCP declarations stay unchanged.

```json
"proposal": {
  "type": "object",
  "additionalProperties": false,
  "description": "Chat metadata of this proposal; see the system prompt, section Changes.",
  "properties": {
    "suggested": {"type": "boolean"},
    "reason": {"type": "string", "maxLength": 200},
    "refs": {
      "type": "object",
      "additionalProperties": {"type": "string", "pattern": "^[0-9a-f-]{36}(#/[a-z0-9_/]+)?$"}
    },
    "summary": {"type": "string", "maxLength": 200}
  }
}
```

- `suggested` true needs a non-empty `reason`. Otherwise the call returns tool error `invalid_arguments`, field `proposal.reason`.
- `refs` maps a JSON pointer into the call's arguments (`/category_id`) to a proposal ID, optionally followed by `#` and a JSON pointer into that proposal's result (default `#/id`). A non-empty `refs` needs a non-empty `summary`.
- The chat catalog budget of chat spec 7.4 becomes 60,000 bytes. The plan records the measured value.

### 4.2 Prompt text

The `chat` audience of `guide.tmpl` changes as follows. Text outside these sections stays.

First paragraph:

> You are the assistant of equori, a personal finance application. You work like a careful bookkeeper who knows this book: you answer from the user's records, which you read with the tools, and from the equori guide, which get_help returns. You prepare the changes the user asks for and the changes their request implies; the user confirms each one on screen.

Section `Changes`:

> Changes
> - Write tools never change data. Each call creates a proposal that the user confirms or rejects on a card below your answer.
> - Never say that a change was made unless the conversation shows a line "[proposal <id> <tool>: executed]" for it.
> - Propose every change the user asked for. Also propose the changes that the request implies and that the records support, with proposal.suggested true and a proposal.reason of one sentence that names the evidence: a signal, a count of transactions, a category that does not exist. At most three suggestions per answer.
> - Never suggest a change that the conversation shows as rejected, or one that a signal or a tool result shows as already done, such as a schedule_id or an existing rule.
> - When a change needs an entity that another proposal of this conversation creates, call the creating tool first. In the dependent call, put "0" in the field, map the field's JSON pointer to the creating proposal_id in proposal.refs, and write proposal.summary as one sentence that says what the change does.
> - In the answer, list the requested changes first and then the suggestions, one sentence each, and say that they wait for the user's confirmation.

New section `Patterns`, shared by both audiences (`{{define "patterns"}}`):

> Patterns
> - Subscription: a proposal result with a signal "recurring", a series from find_recurring, or a payee that is a subscription service you recognize, such as streaming, software, a gym or a phone plan. When no schedule covers it, propose manage_schedule action create, kind subscription, with the series amount and frequency, start on the transaction's date, and paid_by_transaction_id set to the transaction.
> - Category: before choosing a category, compare the purchase with the category names of the book. When no category names this kind of expense or income, propose creating one under the closest parent, named in the answer's language, and use it. Never choose a category whose name contradicts the purchase.
> - Rule: a signal "rule_suggestion" leads to manage_rule action accept_rule_suggestion. When the user categorizes two or more transactions of one payee, or a signal "rule_candidate" appears, and list_rules shows no rule for that payee, propose manage_rule action create_rule.
> - One-off: a purchase without a signal and without a service you recognize gets no subscription suggestion.

For the `mcp` audience, section `Writes` gains: "For a change the request implies, describe it in the answer with its evidence and make it only after the user agrees."

## 5. Dependent proposals

### 5.1 States

`assistant_proposal.status` gains `waiting` and `blocked`.

| From | Event | To |
|---|---|---|
| (new) | refs empty, or every referenced proposal `executed` | refs resolved, preview run: `pending` |
| (new) | some referenced proposal `pending` or `waiting` | `waiting` |
| (new) | some referenced proposal in another state, in another conversation, or missing | tool error `invalid_arguments`, field `proposal.refs` |
| `waiting` | last referenced proposal executes | refs resolved, preview run: `pending` with a new `expires_at`; a tool error sets `failed` with the error as result |
| `waiting` | a referenced proposal becomes `rejected`, `failed`, `stale`, `discarded` or `blocked` | `blocked` |
| `waiting` | `expires_at` passes | shown as expired, like `pending` |

- A `waiting` proposal is stored with its arguments as the model sent them, its `refs`, its `summary`, and the preview `{"action": <action key of chat spec 8.1>, "changes": []}`. Its basis is empty. Arguments are checked against the tool's schema at proposal time (`tool.Set.Validate`, new); the preview runs only at promotion.
- Resolution replaces the value at each pointer of `refs` with the JSON value at the result pointer of the referenced proposal. A missing result pointer sets `failed` with result `{"error": "reference_unresolved", "field": <pointer>}`.
- Promotion and blocking run inside the request that changes the referenced proposal (`Confirm`, `Reject`), after that change, transitively over the dependents.
- `Confirm` of a `waiting` proposal answers 409 `proposal_waiting`. `Reject` of a `waiting` proposal sets `rejected`, and its own dependents become `blocked`.
- `discard` (chat spec 6.2, restart) discards `waiting` proposals of the turn like `pending` ones.
- The model receives `{"proposal_id": ..., "status": "waiting_for_confirmation_of", "waiting_for": [<ids>]}` for a `waiting` proposal.

### 5.2 Schema and API

- New migration: columns `suggested boolean NOT NULL DEFAULT false`, `reason text`, `summary text`, `refs jsonb`; the status `CHECK` adds `waiting` and `blocked`; the decided_at `CHECK` reads `(status IN ('pending', 'executing', 'waiting')) = (decided_at IS NULL)`.
- `AssistantProposal` in `api/openapi.yaml` gains `suggested` (boolean, required), `reason`, `summary` (strings), `waiting_for` (array of uuid, required, empty when none), and the status enum gains `waiting` and `blocked`.
- New `Problem.code`: `proposal_waiting` (409).

### 5.3 History

The proposal line of chat spec 5.3 becomes `[proposal <id> <tool>[ suggested]: <status>[; id <value>]]`. `suggested` appears for a suggestion. `; id <value>` appears for an `executed` proposal whose result has a string or number at `/id`. Earlier turns can then reference an entity created and confirmed before.

## 6. Recurrence detector

`planning` computes series of recurring expenses from ledger transactions. It reads them through the ledger's public API that the plan names.

- Input: transactions of the book, not voided, dated in the 400 days up to today, that move money from a balance account to an expense category.
- Key: `payee_id` when present; otherwise the description folded with `platform/textfold`. A series is one key on one balance account.
- Cadence by the median interval in days between consecutive dates: weekly 6 to 8, monthly 27 to 33, quarterly 85 to 97, yearly 355 to 375. Another median gives no series.
- A series qualifies when at least 75 percent of its intervals fall in the cadence's band, the largest amount is at most 1.25 times the smallest, and it has at least 3 transactions. For monthly and yearly cadences, 2 transactions qualify.
- Output per series: `key` (payee name or description), `payee_id`, `account_id`, `account`, `category_id`, `category` (the most frequent), `frequency`, `count`, `last_date`, `last_amount`, `next_date` (last date plus one cadence), `transaction_ids` (the 6 most recent), and `schedule_id` of an active schedule on the same balance account and counterpart category whose amount is within 25 percent of `last_amount`, empty when none.

Read tool `find_recurring` (planning, read_only). Arguments: optional `payee_id`, `account_id`, `text` (folded match on the key). It returns at most 20 series, the most recent `last_date` first. Its description follows chat spec 7.1 ("Use ...", "Do not use ...").

## 7. Signals

`Service.Propose` attaches `signals` to the result the model receives for a proposal whose preview creates or changes a transaction. Port `app.Signals func(ctx context.Context, booksID int64, p tool.Preview) ([]Signal, error)` is set by `internal/server` (like `UseNotices`). A signal error is logged and the proposal is returned without signals.

```go
// Signal is evidence the model receives with a proposal (spec 2026-11-03 section 7).
type Signal struct {
	Kind string          `json:"kind"` // recurring | rule_suggestion | rule_candidate
	Data json.RawMessage `json:"data"`
}
```

- Input: the `after` values of the preview's changes `payee`, `description`, `account`, `category`, `amount`, `date`. The plan lists the tools whose previews carry them and adds a missing field to a preview of `record_transaction`, `handle_card_purchase`, `categorize_transactions` and `change_transaction`.
- `recurring`: the detector over the proposal's key, with the proposed transaction added on its date. Data: the series of section 6.
- `rule_suggestion`: a pending classification suggestion whose payee is the proposal's payee. Data: suggestion ID, pattern, category.
- `rule_candidate`: the payee has 3 or more transactions in the proposal's category in the last 180 days, categorized by hand, and no rule matched them. Data: payee, category, count.

## 8. Turn-start context

Before the agent runs, `Service.Turn` calls `list_accounts` and `list_schedules` through the chat tool set with `{}` and the turn's context. The prompt gains a section after `Data`:

> Book at the start of this turn
> list_accounts: <output>
> list_schedules: <output>

- An output above 12 KiB is replaced by `(too long; call <tool>)`. A tool error is replaced by `(unavailable; call <tool>)`.
- The `Data` line "Find IDs with the read tools: list_accounts for accounts and categories" becomes "Find IDs in the section Book at the start of this turn, then with the read tools: search_transactions for transactions, list_payees_and_tags for payees, tags and institutions."

## 9. Interface

- A card with `suggested` true shows the label `assistant.proposal.suggested` and its `reason` under the preview.
- A `waiting` card shows its `summary`, the line `assistant.proposal.waiting` naming the action of each proposal in `waiting_for`, and no action buttons.
- A `blocked` card shows `assistant.proposal.blocked` and no action buttons.
- After a confirm or reject, the panel refetches the conversation's proposals, so a promoted card shows its preview.
- "Confirm all" (`confirm-all.tsx`) includes `waiting` cards in their order and stops at the first proposal that does not execute (unchanged).

| Key | pt-BR | en |
|---|---|---|
| `assistant.proposal.suggested` | Sugestão | Suggestion |
| `assistant.proposal.waiting` | Aguarda a confirmação de: {actions} | Waits for the confirmation of: {actions} |
| `assistant.proposal.blocked` | Não executada: a proposta de que depende não foi confirmada. | Not executed: the proposal it depends on was not confirmed. |

## 10. Evaluation

New tasks E21 to E28 in `testdata/eval/tasks.json`. Seed additions in `evalseed_test.go`: Netflix on 2026-08-28 (55.90, Itaú Visa, Subscriptions); Spotify on 2026-08-15, 2026-09-15, 2026-10-15 (21.90, Nubank checking, Subscriptions); payee "99" with three rides without category in October; payee "Drogaria São Paulo" with three purchases without category in October; no category whose name holds "Farmácia", "Pharmacy", "Academia" or "Gym".

| ID | Message | Grader |
|---|---|---|
| E21 | Lança Netflix 55,90 no cartão Itaú hoje. | proposals `record_transaction` (requested) and `manage_schedule` action `create`, kind `subscription`, suggested, with `refs` on `/paid_by_transaction_id` to the first; after confirm all, a subscription schedule exists and its occurrence of 2026-10-23 is linked to the new transaction |
| E22 | Paguei 89,90 da academia Smart Fit hoje no Nubank. | a proposal creating an expense category whose name holds `Academia`, `Gym` or `Fitness`, and `record_transaction` with `refs` on its category field to it |
| E23 | Categoriza as compras da Drogaria São Paulo. | a proposal creating a category whose name holds `Farmácia` or `Pharmacy`, and `categorize_transactions` of the three purchases with `refs` to it |
| E24 | Categoriza as corridas da 99 como Transporte. | `categorize_transactions` of the three rides and a suggested `manage_rule` action `create_rule` for payee 99 |
| E25 | Lança um almoço de 32 reais no Nubank hoje, categoria Restaurante. | one proposal `record_transaction`; no `manage_schedule` proposal |
| E26 | Quais assinaturas eu tenho? | answer names `Netflix` and `Spotify`; no proposal |
| E27 | Lança o Spotify de novembro, 21,90, no Nubank, dia 15/11. | `record_transaction`; no `manage_schedule` proposal when the seed holds a Spotify schedule; a suggested one otherwise. The seed holds one |
| E28 | Lança 250 no posto Shell hoje no cartão Itaú. | one proposal `record_transaction`; no suggestion |

Thresholds for E21 to E28, fixed before the first run: task success over all trials ≥ 0.70; pass^3 ≥ 0.50 of the tasks; mean model steps per trial ≤ 7; mean input tokens per trial ≤ 120,000. E25, E27 and E28 (no spurious suggestion) need 1.00. E01 to E20 keep the thresholds of chat spec 13.2, except mean model steps ≤ 4.5 and mean input tokens ≤ 60,000, raised by the context of section 8. The owner runs the evaluation (CLAUDE.md: agents never run tag `eval`).

## 11. Guide

- Article `privacy_and_the_assistant` gains a paragraph on suggestions and on cards that wait for another card.
- Article `schedules_and_occurrences` gains a sentence: the assistant suggests a subscription when a purchase repeats.
- `CONTRIBUTING.md`, section Code, gains the rule of ID10.

## 12. Region-dependent values

No value of this spec depends on region. The cadence bands follow the calendar of every region. Category names come from the model in the answer's language (chat spec D4). The recognition of a subscription service from its name stays with the model, so no merchant list exists to extend.

## 13. Edge cases

| Case | Expected |
|---|---|
| A ref to a proposal of another conversation | tool error `invalid_arguments`, field `proposal.refs` |
| A ref to a rejected proposal | tool error, same field |
| The parent is rejected | every transitive dependent `blocked` |
| The parent executes, the dependent's preview fails | dependent `failed`, result the tool error; its own dependents `blocked` |
| The parent's result lacks the pointer | dependent `failed`, `reference_unresolved` |
| Confirm of a `waiting` proposal | 409 `proposal_waiting` |
| Turn restart (chat spec 6.2) | `waiting` proposals of the turn `discarded` |
| A suggestion without reason | tool error, field `proposal.reason` |
| A series of 2 weekly transactions | no series |
| A monthly series with one price increase of 20 percent | one series |
| A series already covered by a schedule | series with `schedule_id`; the prompt forbids the suggestion |
| `list_accounts` output above 12 KiB | prompt line `(too long; call list_accounts)` |
| A signal lookup fails | proposal returned without `signals`; warning logged |

## 14. Left to the builder

- The ledger read that the detector uses, and whether a new ledger query is needed.
- The order of columns in the migration and the names of sqlc queries.
- The layout of the suggestion label inside the card, within `docs/contributing/web.md`.
