# Assistant Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A conversational assistant in equori that answers from the user's data through 36 task-oriented tools, explains the product from a guide, points to screens, and executes writes only after the user confirms each proposal.

**Architecture:** Module `assistant` runs an agent loop (`llm.Run`) over a tool set built from every module's `adapter/toolapi`; write tools store proposals that a separate operation confirms. The turn streams progress over Server-Sent Events. The web panel renders answers, proposals and the provider notice.

**Tech Stack:** Go 1.26 (standard library, pgx, sqlc, goose, oapi-codegen, `github.com/google/jsonschema-go`), PostgreSQL, React with `@slotted/react`, TanStack Router and Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-assistant-chat-design.md` (cited as "spec N"). Audit: `docs/superpowers/specs/2026-10-23-assistant-infra-audit.md`. ADR: `docs/adr/020-assistant-conversation.md`.

**Companion files** (part of this plan; executors read the ones their task names):
- `docs/superpowers/plans/2026-10-23-assistant-chat/tools.md`: tasks 9 to 18, one per module `toolapi`.
- `docs/superpowers/plans/2026-10-23-assistant-chat/appendix-a-declarations.md`: every tool's name, description and Go input struct, verbatim.
- `docs/superpowers/plans/2026-10-23-assistant-chat/appendix-b-guide.md`: the 19 guide articles, verbatim.
- `docs/superpowers/plans/2026-10-23-assistant-chat/appendix-c-navigation.md`: the navigation map JSON, verbatim.
- `docs/superpowers/plans/2026-10-23-assistant-chat/appendix-d-texts.md`: system prompt, problem details, web catalog keys and texts.
- `docs/superpowers/plans/2026-10-23-assistant-chat/appendix-e-evaluation.md`: seed, 20 tasks and graders.

## Global Constraints

- Read `CLAUDE.md` and, for `web/`, `web/CLAUDE.md` before the first edit. Their rules win over this plan.
- Work on branch `main` in the main worktree. Stage only the files your task lists; the tree may hold changes of other sessions (`git status` before `git add`); never `git add -A` or `git add .`.
- One commit per task, Conventional Commits (`<type>(<scope>): <summary>`, lowercase, imperative, ≤ 72 characters); no AI attribution, no `Co-Authored-By`.
- TDD: write the test, run it, read the failure, then implement. Never delete a test, add `t.Skip`, loosen an assertion or change an expected value to pass. When a task changes an existing test because the spec changes the behaviour, the commit body names the spec section.
- Never edit `*.gen.go`, `web/src/api/schema.gen.ts` by hand, or an applied migration. After editing `api/openapi.yaml`, `db/queries` or `db/migrations`, run `make gen`.
- Every table has `user_id`; every query on it filters by `user_id`. No tool input property names a user. No `float64` for amounts.
- No regional literal (currency, language, format) outside a region's code; amounts in tools come from the account's instrument.
- Logs never carry tool arguments, tool results or message text.
- No new dependency (Go or web).
- Verification per task: the package tests of the changed packages (`go test ./internal/<pkg>/...`, `pnpm --dir web exec vitest run <path>`) and `go vet` of them. `make check` runs only in Task 24.
- Every new `operationId` gets an entry in `internal/server/tool_exposure_test.go`.
- Test database: `make db-up` once per machine; tests use `pgtest.New(t)` through `apitest.New(t)`.

## Review Focus

1. A confirm request repeated while the first is still running (double click): exactly one execution; the second answers 409 `proposal_closed`. Test: Task 6, `TestConfirmConcurrent`.
2. A turn whose client disconnects mid-stream: the turn stops, no assistant message is stored, the user message stays. Test: Task 8, `TestTurnClientDisconnect`.
3. A tool argument with an ID of another user (`account_id`, `transaction_id`, `statement_id`): the tool returns the module's not-found error, never data. Test: each tools task, `Test<Tool>OtherUser`, plus Task 23 review.
4. A history whose text contains Markdown links to paths outside the navigation map or `javascript:` URLs: the panel renders plain text. Test: Task 20, `answer-markdown.test.ts`.
5. An amount written by the model in any locale format (`R$ 1.234,56`, `$1,234.56`, `1234.56 BRL`) while privacy mode is on: masked. Test: Task 20, `mask-amounts.test.ts`.

## Order and parallelism

| Wave | Tasks | Runs in parallel |
|---|---|---|
| 1 | 1, 2 | yes (different packages) |
| 2 | 3, 4 | yes |
| 3 | 5, 6 | no: 6 after 5 (both touch `internal/assistant`) |
| 4 | 7, then 8 | no |
| 5 | 9 to 18 | two at a time, any order, after 8; 10 after 9, 11 and 12 after 10 (same package) |
| 6 | 19, then 20 | no |
| 7 | 21, 22 | yes |
| 8 | 23 (main session), 24 (main session) | no |

Approved batch (owner, 2026-10-23): 10 Sonnet subagents, at most 2 at a time, each with a budget of 60 tool calls (owner's exception to the 40 of `~/.claude/CLAUDE.md`), the other bounds of that file unchanged:

| Agent | Tasks |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 4, 5 |
| 4 | 6, 7 |
| 5 | 8 |
| 6 | 9, 10 |
| 7 | 11, 12 |
| 8 | 14 |
| 9 | 15, 16, 17 |
| 10 | 19, 20 |

Main session tasks: 3, 13, 18, 21, 22, 23 and 24. An agent that reaches its budget stops and reports; the main session continues from its report. The Markdown answer parser is the own subset parser of Task 20 (no `marked` dependency) unless the owner says otherwise.

---

### Task 1: Tool choice, pinning and the turn loop in `platform/llm`

Spec 6.2; audit items 4 and 5.

**Files:**
- Modify: `internal/platform/llm/request.go`, `internal/platform/llm/router.go`, `internal/platform/llm/tools.go`
- Modify: `internal/platform/llm/aistudio/wire.go`, `internal/platform/llm/aistudio/aistudio.go`, `internal/platform/llm/openai/wire.go`
- Modify: `internal/server/tools_live_test.go`
- Test: `internal/platform/llm/tools_test.go`, `internal/platform/llm/router_test.go`, `internal/platform/llm/aistudio/aistudio_test.go`, `internal/platform/llm/openai/openai_test.go`

**Interfaces:**
- Produces:
  - `type ToolChoice string`; `const ToolChoiceAuto ToolChoice = ""`, `ToolChoiceNone ToolChoice = "none"`.
  - `Request.ToolChoice ToolChoice`; `Request.Pin Target` (zero value: any target).
  - `type LoopOptions struct { MaxSteps int; ForceAnswer bool; Pin bool; OnToolCall func(ToolCall); OnRestart func() }`
  - `type Result struct { Response Response; History []Message; Steps int; Usage Usage; Restarted bool; StepLimit bool }`
  - `func Run(ctx context.Context, client *Client, req Request, handlers map[string]ToolHandler, opts LoopOptions) (Result, error)`
  - `RunTools` keeps its signature and behaviour; it calls `Run` with `LoopOptions{MaxSteps: maxSteps}`.

- [ ] **Step 1: Write the failing tests** in `tools_test.go` (reuse `calls`, `handler`, `text`, `prompt`, `target`, `newFixture`):
  - `TestRunForcesAnswer`: provider `a` steps: `calls(c1)`, `calls(c2)`, `text("done")`; `Run(..., LoopOptions{MaxSteps: 3, ForceAnswer: true})`. Assert: `a.Requests()[2].Request.ToolChoice == llm.ToolChoiceNone`, requests 0 and 1 have `ToolChoiceAuto`; `res.StepLimit == true`; `res.Steps == 3`; `res.Response.Text() == "done"`; error nil.
  - `TestRunForcedStepStillCalling`: steps `calls(c1)`, `calls(c2)` with `MaxSteps: 2, ForceAnswer: true`: the second response's tool call is not executed (handler counter stays 1), `res.StepLimit == true`, error nil.
  - `TestRunWithoutForceKeepsLimit`: `MaxSteps: 1`, steps `calls(c1)`: error `errors.Is(err, llm.ErrTooManySteps)`.
  - `TestRunAssignsCallIDs`: steps `calls(llm.ToolCall{Name: "balance", Args: {}})` (empty ID), `text("ok")`: `res.History[1].Parts[0].ToolCall.ID == "call_1_0"` and `res.History[2].Parts[0].ToolResult.CallID == "call_1_0"`.
  - `TestRunOnToolCall`: two calls in one response: `OnToolCall` receives names `["balance", "rate"]` in order.
  - `TestRunPinsAndRestarts`: providers `a` and `b`, chain `a/m1`, `b/m1`, `Pin: true`. `a` steps: `calls(c1)`, then `Err: &llm.QuotaError{RetryAfter: time.Minute}`. `b` steps: `calls(c1)`, `text("from b")`. Assert: `res.Restarted`, `OnRestart` called once, `b.Requests()[0].Request.Messages` equals `prompt().Messages` (length 1), `a.Requests()[1].Request.Pin == target("a/m1")`, `res.Response.Text() == "from b"`, `res.Steps == 2`.
  - `TestRunRestartsOnce`: as above, but `b`'s second step also fails with `QuotaError`: error `errors.Is(err, llm.ErrExhausted)`.
  - `TestRunSumsUsage`: steps with `Usage{InputTokens: 10, OutputTokens: 2}` and `{20, 3}`: `res.Usage == llm.Usage{InputTokens: 30, OutputTokens: 5}`.
  In `router_test.go`:
  - `TestClientPin`: chain `a/m1`, `b/m1`; `req.Pin = target("b/m1")`: `a` receives no request, `b` answers.
  - `TestClientPinCooling`: `a/m1` cooling down (quota error on a first call), `req.Pin = target("a/m1")`: `errors.Is(err, llm.ErrExhausted)` and `b` receives no request.
  In `aistudio_test.go`, `TestGenerateToolChoiceNone`: a request with one tool and `ToolChoice: llm.ToolChoiceNone` sends body containing `"toolConfig":{"functionCallingConfig":{"mode":"NONE"}}`; with `ToolChoiceAuto` the body has no `toolConfig`.
  In `openai_test.go`, `TestGenerateToolChoiceNone`: body contains `"tool_choice":"none"`; with `ToolChoiceAuto`, no `tool_choice` key.

- [ ] **Step 2: Run** `go test ./internal/platform/llm/...` — expect compile errors naming `llm.Run`, `llm.LoopOptions`, `ToolChoice`, `Pin`.

- [ ] **Step 3: Implement.**
  - `Client.Generate`: when `req.Pin` is not the zero `Target`, keep only bindings whose target equals it; when none remains or it is cooling down, return `&ExhaustedError{RetryAt: <its cooldown end, or now>}` after the same attempt handling as today (a quota error on the pinned target sets its cooldown and returns `*ExhaustedError`).
  - `Run`: loop of at most `MaxSteps` model calls per attempt. Before a call, set `req.ToolChoice = ToolChoiceNone` when `ForceAnswer` and this is the last allowed call; set `req.Pin` to the first response's `Target` for every call after the first when `opts.Pin`. After a response, give each `ToolCall` with an empty ID the ID `fmt.Sprintf("call_%d_%d", step, index)` (step counts from 1 within the attempt, index from 0 within the response). A forced response is never executed: return it with `StepLimit: true`. On an error that `errors.Is(err, ErrExhausted)` from a pinned call (step ≥ 2) and no earlier restart: call `OnRestart`, reset history to `req.Messages`, clear the pin and step count, set `Restarted`, and loop again. Add `Response.Usage` of every call to `Result.Usage`. `Steps` counts model calls of the final attempt.
  - Adapters: `aistudio` adds `ToolConfig *toolConfig` (`json:"toolConfig,omitempty"`) with `functionCallingConfig.mode = "NONE"` when `ToolChoice == ToolChoiceNone` and tools are present; `openai` adds `ToolChoice string` (`json:"tool_choice,omitempty"`) set to `"none"` under the same condition.
  - `internal/server/tools_live_test.go`: after the existing call, run `llm.Run` with `LoopOptions{MaxSteps: 2, ForceAnswer: true}` and the message "Call list_accounts, then call get_balances, then answer."; assert no error and a non-empty text. It runs only with `-tags live` (Task 24).

- [ ] **Step 4: Run** `go test ./internal/platform/llm/... && go vet ./internal/platform/llm/...` — PASS, including the unchanged `TestRunTools`.

- [ ] **Step 5: Commit** `feat(platform): add tool choice, pinning and restart to the tool loop` (files above).

---

### Task 2: Decimal amounts and write previews in `platform/money` and `platform/tool`

Spec 8.1, 8.4.

**Files:**
- Create: `internal/platform/money/decimal.go`, `internal/platform/money/decimal_test.go`
- Create: `internal/platform/tool/preview.go`, `internal/platform/tool/preview_test.go`
- Modify: `internal/platform/tool/tool.go`, `internal/platform/tool/registry.go`, `internal/platform/tool/value.go`

**Interfaces:**
- Produces:
  - `money.ErrInvalidDecimal`; `func ParseDecimal(s string, code Currency, scale int) (Money, error)` accepts `^-?[0-9]{1,16}(\.[0-9]+)?$` with at most `scale` fraction digits and builds with `NewOf` (so instrument codes work).
  - `func tool.ParseAmount(field, s string, unit money.Money) (money.Money, error)`: `unit` carries code and scale (`unit.Currency()`, `unit.Scale()`); a parse failure returns `InvalidArgument(field, "must be a decimal such as 125.90 with at most <scale> decimals")`.
  - `func tool.ParsePositive(field, s string, unit money.Money) (money.Money, error)`: as `ParseAmount`, and a value ≤ 0 returns `InvalidArgument(field, "must be greater than zero")`.
  - `type Value struct { Text string \`json:"text,omitzero"\`; Amount string \`json:"amount,omitzero"\`; Currency string \`json:"currency,omitzero"\`; Date string \`json:"date,omitzero"\` }`; `func TextValue(s string) Value`; `func MoneyValue(m money.Money) Value`; `func DateValue(t time.Time) Value`.
  - `type Change struct { Field string \`json:"field"\`; Before Value \`json:"before,omitzero"\`; After Value \`json:"after,omitzero"\` }`
  - `type Preview struct { Action string \`json:"action"\`; Target string \`json:"target,omitzero"\`; Changes []Change \`json:"changes"\`; Destructive bool \`json:"destructive,omitzero"\`; Basis string \`json:"-"\` }`
  - `var ChangeFields = []string{...}`: the 42 keys of spec 8.4, in that order.
  - `func NewWrite[In, Out any](s Spec, preview func(ctx context.Context, userID int64, in In) (Preview, error), h func(ctx context.Context, userID int64, in In) (Out, error)) Tool`: panics when `s.Effect == ReadOnly`, otherwise as `New`.
  - `func (t Tool) HasPreview() bool`
  - `var ErrNoPreview = errors.New("tool has no preview")`
  - `func (r *Registry) Preview(ctx context.Context, name string, args json.RawMessage) (Preview, Result, error)`: same argument validation, user check and error mapping as `Call`; on success returns the preview and a zero `Result`; on a tool error returns a zero `Preview` and the `Result` with `IsError`; a change whose `Field` is not in `ChangeFields` becomes `internal_error` (logged). Logs `tool preview` with the same attributes as `tool call`.
  - `func (s Set) Preview(ctx context.Context, name string, args json.RawMessage) (Preview, Result, error)` checks membership like `Set.Call`.
  - `func PreviewDigest(p Preview) string`: hex SHA-256 of `json.Marshal(p)` followed by `p.Basis`.

- [ ] **Step 1: Write the failing tests.**
  - `decimal_test.go`, `TestParseDecimal` (table, `BRL` scale 2 unless stated): `"125.90"` → 12590; `"-0.5"` → -50; `"7"` → 700; `"1.234"` → `ErrInvalidDecimal`; `"1,50"` → `ErrInvalidDecimal`; `""` → `ErrInvalidDecimal`; `"+1"` → `ErrInvalidDecimal`; `"10.5"` with code `MXRF11` scale 0 → `ErrInvalidDecimal`; `"10"` with `MXRF11` scale 0 → amount 10; `"0.00000001"` with `BTC` scale 8 → 1.
  - `preview_test.go`:
    - `TestNewWritePanicsOnReadOnly`: `NewWrite` with `Effect: ReadOnly` panics.
    - `TestRegistryPreview`: a write tool `rename` (input `{name string}`) whose preview returns `Preview{Action: "rename", Target: "Account Checking", Changes: []Change{{Field: "name", Before: TextValue("Checking"), After: TextValue(in.Name)}}}` and whose handler increments a counter. `r.Preview(userCtx, "rename", {"name":"Main"})` returns that preview, `res.IsError == false`, counter 0.
    - `TestRegistryPreviewInvalid`: arguments `{}` → `res.IsError` with code `invalid_arguments`; counter 0.
    - `TestRegistryPreviewUnknownField`: preview returning `Field: "colour"` → `res.IsError`, code `internal_error`, log line `tool failed`.
    - `TestRegistryPreviewWithout`: `r.Preview` on a `New` tool → `errors.Is(err, ErrNoPreview)`.
    - `TestPreviewDigest`: equal previews with `Basis` "v1" give equal digests; `Basis` "v2" gives another; changing `After` gives another; the digest is 64 hex characters.
    - `TestParseAmount`: `ParsePositive("amount", "0", unitBRL)` → field error `amount` "must be greater than zero"; `ParseAmount("amount", "-3.10", unitBRL)` → -310.
- [ ] **Step 2: Run** `go test ./internal/platform/money/ ./internal/platform/tool/` — FAIL (undefined names).
- [ ] **Step 3: Implement** the interfaces above. `Tool` gains an unexported `preview func(ctx, userID int64, args []byte) (Preview, error)` that decodes `In` like `call`.
- [ ] **Step 4: Run** the same command — PASS; existing tool tests unchanged.
- [ ] **Step 5: Commit** `feat(platform): add decimal parsing and previews of write tools`.

---

### Task 3: Catalog gates and exposure vocabulary

Spec 7.1, 7.2 (exclusions), 7.4; audit items 2, 3, 8.

**Files:**
- Modify: `internal/server/tool_exposure_test.go`, `internal/server/tools_test.go`, `internal/server/testdata/tools.json`
- Modify: `internal/ledger/internal/adapter/toolapi/accounts.go`, `transactions.go` (descriptions only), `internal/reporting/internal/adapter/toolapi/categories.go`
- Create: `internal/server/catalog_quality_test.go`

**Interfaces:**
- Produces (in `package server_test`):
  - `exclusions` map: `-session`, `-binary`, `-capture`, `-llm`, `-secret`, `-file`, `-visual`, `-setup`, and, until Task 23 removes them, `-write`, `-pending`.
  - `var withoutOperation = map[string]string{"get_help": "answers from the guide and the navigation map, not from an operation"}`: tools allowed to map to no operation.
  - `func chatTools(t *testing.T) []tool.Tool`: every tool of `h.App.Tools.Tools()`.

- [ ] **Step 1: Write the failing tests** in `catalog_quality_test.go`:
  - `TestToolCatalogQuality`: for each tool, the description contains a sentence starting `Use ` and a sentence starting `Do not use `; every input property (recursing into `items` and nested `properties`) has a non-empty `description`; the encoded declaration `{"name","description","parameters"}` is at most 3,000 bytes; the sum over all tools is at most 50,000 bytes. Failure messages name the tool and property.
  - `TestToolInputsHaveNoUser`: no input property name, at any depth, matches `(?i)user`.
  - Update `TestToolExposure`: the allowed exclusions are the map above; the error message lists them; a registry tool that maps to no operation fails unless it is in `withoutOperation`.
  - In `tool_exposure_test.go`, change the entries of this table now (the others change in tasks 9 to 18):

| Operation | Entry |
|---|---|
| createIntegration, updateIntegrationCredentials, createConnection | `-secret` |
| importFile, createAttachment, deleteAttachment, saveCsvProfile, getCsvProfile, importPrices | `-file` |
| setAccountAppearance, setInstitutionIdentifier, listInstitutionIdentifierSchemes | `-visual` |
| updateSettings | `-setup` |

- [ ] **Step 2: Run** `go test ./internal/server/ -run 'TestToolCatalogQuality|TestToolInputsHaveNoUser|TestToolExposure'` — FAIL: the four current descriptions lack "Use"/"Do not use".
- [ ] **Step 3: Replace** the `Description` of `list_accounts`, `get_balances`, `search_transactions` and `get_category_totals` and the `jsonschema` tags of their input fields with the text of Appendix A. In `get_category_totals`, add `ParentName string \`json:"parent_name,omitzero"\`` to `categoryView`, filled from the parent's `Name` in the same totals list (audit item 3).
- [ ] **Step 4: Run** `go test ./internal/server/ -run TestToolCatalog -update`, review the diff of `testdata/tools.json` (only descriptions and `parent_name`), then `go test ./internal/server/ ./internal/ledger/... ./internal/reporting/...` — PASS.
- [ ] **Step 5: Commit** `test(api): gate tool descriptions, inputs and exposure reasons`; body names spec 7.1 and 7.2.

---

### Task 4: Conversation persistence in `assistant`

Spec 5.1, 5.2; ADR 020 C1.

**Files:**
- Create: `db/migrations/00058_assistant_conversation.sql`
- Create: `db/queries/assistant/conversation.sql`, `db/queries/assistant/proposal.sql`
- Create: `internal/assistant/internal/domain/conversation.go`, `conversation_test.go`, `proposal.go`, `proposal_test.go`
- Create: `internal/assistant/internal/adapter/postgres/conversation.go`, `conversation_test.go`, `proposal.go`, `proposal_test.go`
- Modify: `internal/assistant/internal/app/ports.go`, `internal/assistant/schema_test.go`
- Generated: `internal/assistant/internal/adapter/postgres/*.sql.gen.go` (`make gen`)

**Interfaces:**
- Produces (`domain`):
  - `type Role string` (`RoleUser = "user"`, `RoleAssistant = "assistant"`); `type Outcome string` (`OutcomeNone = ""`, `OutcomeAnswered = "answered"`, `OutcomeStepLimit = "step_limit"`, `OutcomeFailed = "failed"`).
  - `type Conversation struct { ID uuid.UUID; Title string; CreatedAt, UpdatedAt time.Time }`
  - `type Message struct { ID, ConversationID uuid.UUID; Seq int; Role Role; Content string; Outcome Outcome; CreatedAt time.Time }`
  - `type ProposalStatus string`: `pending`, `executing`, `executed`, `failed`, `rejected`, `stale`, `discarded`.
  - `type Proposal struct { ID, ConversationID, MessageID uuid.UUID; Tool string; Arguments, Preview, Result []byte; Basis string; Status ProposalStatus; CreatedAt, ExpiresAt, DecidedAt time.Time }` (`MessageID` is `uuid.Nil` until attached, `DecidedAt` zero until decided).
  - `const ProposalTTL = 15 * time.Minute`; `func (p Proposal) Expired(now time.Time) bool` (pending and `!now.Before(ExpiresAt)`).
  - `const MaxTitle = 80`; `func Title(text string) string`: whitespace collapsed; at most 80 runes, cut at the last space before rune 80 when one exists after rune 40, else at rune 80.
  - `const MaxMessage = 4000` (user text, runes); `const MaxAnswer = 16000`.
- Produces (`app/ports.go`), interface `ConversationRepository`, embedded in `Repository`:
  - `CreateConversation(ctx, userID int64, c domain.Conversation) error`
  - `Conversation(ctx, userID int64, id uuid.UUID) (domain.Conversation, error)` — `ErrConversationNotFound` when absent.
  - `Conversations(ctx, userID int64, after *ConversationKey, limit int) ([]domain.Conversation, error)` with `type ConversationKey struct { UpdatedAt time.Time; ID uuid.UUID }`, ordered `updated_at DESC, id DESC`.
  - `DeleteConversation(ctx, userID int64, id uuid.UUID) error` (`ErrConversationNotFound` when no row), `DeleteConversations(ctx, userID int64) error`.
  - `AppendMessage(ctx, userID int64, m domain.Message) (domain.Message, error)`: `seq` = 1 + the conversation's highest; also sets the conversation's `updated_at` to `m.CreatedAt`; returns the stored message.
  - `Messages(ctx, userID int64, conversationID uuid.UUID) ([]domain.Message, error)` by `seq`.
  - `InsertProposal(ctx, userID int64, p domain.Proposal) error`; `Proposal(ctx, userID int64, id uuid.UUID) (domain.Proposal, error)` (`ErrProposalNotFound`); `Proposals(ctx, userID int64, conversationID uuid.UUID) ([]domain.Proposal, error)` by `created_at`.
  - `ClaimProposal(ctx, userID int64, id uuid.UUID, now time.Time) (domain.Proposal, bool, error)`: the `UPDATE … SET status = 'executing' … WHERE status = 'pending' AND expires_at > now RETURNING`; `false` when no row changed.
  - `DecideProposal(ctx, userID int64, id uuid.UUID, status domain.ProposalStatus, result []byte, at time.Time) error`
  - `RejectProposal(ctx, userID int64, id uuid.UUID, now time.Time) (bool, error)`: pending and not expired → `rejected`.
  - `AttachProposals(ctx, userID int64, messageID uuid.UUID, ids []uuid.UUID) error`; `DiscardProposals(ctx, userID int64, ids []uuid.UUID, at time.Time) error` (only rows still `pending`).
  - Errors in `domain/errors.go`: `ErrConversationNotFound`, `ErrProposalNotFound`.

Migration (exact):

```sql
-- +goose Up
CREATE TABLE assistant_conversation (
    id         uuid        NOT NULL,
    user_id    bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    title      text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (id, user_id)
);
CREATE INDEX assistant_conversation_recent ON assistant_conversation (user_id, updated_at DESC, id DESC);

CREATE TABLE assistant_message (
    id              uuid        NOT NULL,
    user_id         bigint      NOT NULL,
    conversation_id uuid        NOT NULL,
    seq             integer     NOT NULL CHECK (seq >= 1),
    role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
    content         text        NOT NULL CHECK (char_length(content) <= 16000 AND (role = 'assistant' OR char_length(content) >= 1)),
    outcome         text        CHECK (outcome IN ('answered', 'step_limit', 'failed')),
    created_at      timestamptz NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (conversation_id, seq),
    CHECK ((role = 'user') = (outcome IS NULL)),
    FOREIGN KEY (conversation_id, user_id) REFERENCES assistant_conversation (id, user_id) ON DELETE CASCADE
);

CREATE TABLE assistant_proposal (
    id              uuid        NOT NULL,
    user_id         bigint      NOT NULL,
    conversation_id uuid        NOT NULL,
    message_id      uuid,
    tool            text        NOT NULL CHECK (tool ~ '^[a-z][a-z0-9_]{0,63}$'),
    arguments       jsonb       NOT NULL,
    preview         jsonb       NOT NULL,
    basis           text        NOT NULL CHECK (basis ~ '^[0-9a-f]{64}$'),
    status          text        NOT NULL CHECK (status IN ('pending', 'executing', 'executed', 'failed', 'rejected', 'stale', 'discarded')),
    result          jsonb,
    created_at      timestamptz NOT NULL,
    expires_at      timestamptz NOT NULL CHECK (expires_at > created_at),
    decided_at      timestamptz,
    PRIMARY KEY (id),
    CHECK ((status IN ('pending', 'executing')) = (decided_at IS NULL)),
    FOREIGN KEY (conversation_id, user_id) REFERENCES assistant_conversation (id, user_id) ON DELETE CASCADE
);
CREATE INDEX assistant_proposal_conversation ON assistant_proposal (user_id, conversation_id, created_at);

-- +goose Down
DROP TABLE assistant_proposal;
DROP TABLE assistant_message;
DROP TABLE assistant_conversation;
```

Before writing, run `ls db/migrations | tail -3`; when `00058` is taken, use the next free number and keep the name.

- [ ] **Step 1: Write the failing tests.**
  - `domain/conversation_test.go`, `TestTitle`: `"  Quanto  gastei\nontem? "` → `"Quanto gastei ontem?"`; a 100-rune text of words of 9 letters and spaces → ends at a word boundary, ≤ 80 runes; a 100-rune text without spaces → its first 80 runes.
  - `domain/proposal_test.go`, `TestExpired`: created 10:00, expires 10:15: at 10:14:59 false, at 10:15:00 true; status `executed` at 10:20 false.
  - `schema_test.go` (invariants, direct SQL on `h.Pool`, each expecting an error): message of a conversation of another user (FK); role `system`; user message with an outcome; assistant message without outcome; content of 16,001 characters; user message with empty content (an assistant message with empty content is accepted); proposal status `done`; proposal `executed` without `decided_at`; basis `abc`; `expires_at = created_at`.
  - `postgres/conversation_test.go` with `pgtest.New(t)` and two users: create, append three messages (`seq` 1, 2, 3), `Messages` returns them in order; `updated_at` equals the last message's `created_at`; `Conversations` with limit 2 returns the two most recent and a key that continues to the third; user B's `Conversation(A's id)` → `ErrConversationNotFound`; `DeleteConversations(B)` leaves A's conversation.
  - `postgres/proposal_test.go`: `ClaimProposal` twice → `true` then `false`; a claim at `expires_at` → `false`; `RejectProposal` on `executing` → `false`; `DiscardProposals` changes only pending rows; deleting the conversation deletes its proposals; user B cannot claim A's proposal (`false`).
- [ ] **Step 2: Run** `go test ./internal/assistant/...` — FAIL (undefined, missing tables).
- [ ] **Step 3: Write** the migration and the queries (sqlc names: `InsertConversation`, `ConversationByID`, `ListConversations`, `DeleteConversation`, `DeleteConversations`, `AppendMessage`, `ListMessages`, `InsertProposal`, `ProposalByID`, `ListProposals`, `ClaimProposal`, `DecideProposal`, `RejectProposal`, `AttachProposals`, `DiscardProposals`); run `make gen`; implement the repository methods on the existing `postgres.Repository`.
- [ ] **Step 4: Run** `go test ./internal/assistant/...` — PASS.
- [ ] **Step 5: Commit** `feat(assistant): store conversations, messages and proposals`.

---

### Task 5: Enforced limits, chat state and the `retry_at` problem member

Spec 6.3; ADR 020 C10; amends ADR 019 P14 and ADR 004.

**Files:**
- Modify: `internal/assistant/internal/app/resolve.go`, `internal/assistant/internal/app/usage.go`, `internal/assistant/internal/adapter/llmapi/llmapi.go`, `internal/assistant/assistant.go`
- Create: `internal/assistant/internal/app/chat.go`, `internal/assistant/internal/adapter/httpapi/chat.go`, `internal/assistant/chat_test.go`, `internal/assistant/limits_test.go`
- Modify: `internal/platform/problem/problem.go`, `internal/platform/problem/problem_test.go`
- Modify: `api/openapi.yaml`, `internal/server/tool_exposure_test.go`; generated files by `make gen`
- Modify: `docs/adr/004-api-errors.md`, `docs/adr/019-language-model-providers.md` (amendment lines of ADR 020)

**Interfaces:**
- Consumes: `app.Service.Resolve` (existing), `UsageRepository` (existing), `domain.Limit`.
- Produces:
  - `problem.Details.RetryAt *time.Time \`json:"retry_at,omitempty"\``; `func problem.WithRetryAt(d Details, at time.Time) Details`.
  - In `app`: `var ErrLimitReached = errors.New("every target is over its daily limit or cooling down")`; `type LimitError struct { RetryAt time.Time }` with `Is(ErrLimitReached)`.
  - `Service.Resolve` drops targets whose user's limit row for (provider ID, model) has `requests_per_day` ≤ today's requests or `tokens_per_day` ≤ today's input plus output tokens. When targets existed and every one was dropped for a limit or has `cooling_until` after now in today's usage row, it returns `*LimitError{RetryAt}`: the earliest `cooling_until` among cooled targets, else the start of tomorrow in the instance time zone (`clock.Today().AddDate(0, 0, 1)` at the clock's location).
  - `llmapi.Resolver.Resolve` maps `*app.LimitError` to `&llm.ExhaustedError{RetryAt}`.
  - `type ChatState struct { Available bool; ProviderName, Model, Notice string; RetryAt time.Time }`; `func (s *Service) ChatState(ctx, userID int64, use Use) (ChatState, error)`: resolve; the first target not cooling and not over limit gives `Available`, its provider's display name, model and preset notice; none → `Available false` and `RetryAt` as above; no target at all → `Available false`, zero `RetryAt`.
  - Operation `getAssistantChat` `GET /assistant/chat`, tag `assistant`, response `AssistantChat`:

```yaml
    AssistantChat:
      type: object
      additionalProperties: false
      required: [available]
      properties:
        available: {type: boolean}
        provider_name: {type: string}
        model: {type: string}
        notice: {type: string, pattern: "^[a-z0-9_]{2,40}$"}
        retry_at: {type: string, format: date-time}
```

  - `Problem` schema gains `retry_at: {type: string, format: date-time}`.
  - Exposure entry: `"getAssistantChat": "-llm"`.
  - `assistant.ChatUse.Default` (`internal/assistant/assistant.go`) becomes, in order: `gemini/gemini-3.5-flash-lite`, `gemini/gemini-3.5-flash`, `groq/openai/gpt-oss-120b`, `mistral/mistral-small-latest`, `ollama/qwen3:32b` (spec 6.4). Tests that assert the old default chain change with it; the commit body names spec 6.4.

- [ ] **Step 1: Write the failing tests.**
  - `problem_test.go`, `TestRetryAt`: `WithRetryAt(New(429, "assistant_exhausted", ""), t)` encodes `"retry_at":"2026-10-23T15:04:05Z"`; a problem without it has no `retry_at` key.
  - `limits_test.go` (through `apitest`, `apitest.LLMFactory` returning `llmtest` providers, `apitest.Today("2026-10-23")`): user with a `gemini` provider and limit `requests_per_day` 1 on `gemini-3.5-flash` (via `PUT /api/v1/assistant/usage/limits`); one call through `h.App.LLM.Use(assistant.ChatUse).Generate` with the user in context succeeds; the second returns `errors.Is(err, llm.ErrExhausted)` with `RetryAt` = 2026-10-24T00:00:00Z and the provider receives exactly one request. A second user without a limit is not affected (S138).
  - `chat_test.go`: `GET /api/v1/assistant/chat` for a user with only the instance Gemini provider → `{"available":true,"provider_name":"Gemini (instance)","model":"gemini-3.5-flash","notice":"trains"}` (use the instance provider's display name already returned by `listProviders`; read it there first and assert that exact value); with every target cooling (a quota error recorded through one call returning `&llm.QuotaError{RetryAfter: time.Hour}`) → `available` false and `retry_at` = the cooldown end; a user with no provider and no instance provider → `{"available":false}`.
- [ ] **Step 2: Run** `go test ./internal/platform/problem/ ./internal/assistant/...` — FAIL.
- [ ] **Step 3: Implement**; add the operation and schema to `api/openapi.yaml` under the `assistant` tag, run `make gen`, implement the handler in `httpapi/chat.go`, add the exposure entry, and append to ADR 004 and ADR 019 a line "Amended by ADR 020" with the rule.
- [ ] **Step 4: Run** `go test ./internal/platform/problem/ ./internal/assistant/... ./internal/server/ -run 'Exposure|Contract'` — PASS.
- [ ] **Step 5: Commit** `feat(assistant): enforce daily limits and report the chat state`.

---

### Task 6: Proposals

Spec 8; ADR 020 C6, C7; scenarios S132–S135.

**Files:**
- Create: `internal/assistant/internal/app/proposal.go`, `internal/assistant/internal/app/chatset.go`
- Create: `internal/assistant/internal/adapter/httpapi/proposal.go`
- Create: `internal/assistant/proposal_test.go`
- Modify: `internal/assistant/assistant.go`, `internal/assistant/internal/app/ports.go`, `api/openapi.yaml`, `internal/server/tool_exposure_test.go`, `internal/assistant/internal/adapter/httpapi/server.go` (error mapping)

**Interfaces:**
- Consumes: Task 2 `tool.Set.Preview`, `tool.Set.Call`, `tool.PreviewDigest`, `tool.Tool.HasPreview`; Task 4 repository.
- Produces:
  - Port in `app`: `type Tools interface { Preview(ctx context.Context, name string, args json.RawMessage) (tool.Preview, tool.Result, error); Call(ctx context.Context, name string, args json.RawMessage) (tool.Result, error); Effect(name string) (tool.Effect, bool) }` (`app` imports `platform/tool`, which imports no module; `depguard` allows it as it allows `platform/page`; if `depguard` refuses, declare local mirror types `PreviewResult` in `app` and adapt in `llmapi`).
  - `func NewChatSet(set tool.Set) (app.Tools, error)` in `llmapi`: returns an error naming the tool when a non-`ReadOnly` tool lacks a preview (spec 8.1).
  - `func (s *Service) Propose(ctx, userID int64, conversationID uuid.UUID, name string, args json.RawMessage) (json.RawMessage, error)`: `Preview`; tool error → returned as `*llm.ToolError`-compatible content through a sentinel `ToolFailure{Content []byte}` the adapter maps; success → insert proposal (`status` pending, `expires_at` = now + `ProposalTTL`, `basis` = `tool.PreviewDigest`), log `assistant proposal` decision `created`, return `{"proposal_id":"<id>","status":"awaiting_confirmation","preview":<preview>}`.
  - `func (s *Service) Confirm(ctx, userID int64, id uuid.UUID) (domain.Proposal, error)`: spec 8.2 steps 1–3; errors `ErrProposalNotFound`, `ErrProposalExpired`, `ErrProposalClosed`, `ErrProposalStale`. The `Call` runs with `auth.WithUserID(ctx, userID)`.
  - `func (s *Service) Reject(ctx, userID int64, id uuid.UUID) (domain.Proposal, error)`.
  - Every decision logs one `assistant proposal` line (spec 14): user ID, proposal ID, tool, decision `created`, `executed`, `failed`, `rejected`, `stale` or `expired`; `discarded` is logged by the turn (Task 8). No arguments, preview or result in the line.
  - In `llmapi`: `func ChatHandlers(svc *app.Service, tools app.Tools, set tool.Set, conversationID func(ctx) uuid.UUID) (decls []llm.Tool, handlers map[string]llm.ToolHandler)`: read tools call `set` directly (as `Set.LLM`); write tools call `svc.Propose`. `conversationID` reads a context value set by the turn (Task 8).
  - Operations (tag `assistant`): `confirmAssistantProposal` `POST /assistant/proposals/{id}/confirm`, `rejectAssistantProposal` `POST /assistant/proposals/{id}/reject`, both responding 200 `AssistantProposal`:

```yaml
    AssistantProposal:
      type: object
      additionalProperties: false
      required: [id, tool, status, preview, created_at, expires_at]
      properties:
        id: {type: string, format: uuid}
        tool: {type: string, pattern: "^[a-z][a-z0-9_]{0,63}$"}
        status: {type: string, enum: [pending, executing, executed, failed, rejected, stale, discarded, expired]}
        preview: {$ref: "#/components/schemas/AssistantPreview"}
        result: {description: "Tool output when executed, tool error when failed."}
        created_at: {type: string, format: date-time}
        expires_at: {type: string, format: date-time}
        decided_at: {type: string, format: date-time}
    AssistantPreview:
      type: object
      additionalProperties: false
      required: [action, changes]
      properties:
        action: {type: string}
        target: {type: string}
        destructive: {type: boolean}
        changes:
          type: array
          items:
            type: object
            additionalProperties: false
            required: [field]
            properties:
              field: {type: string, pattern: "^[a-z_]{2,40}$"}
              before: {$ref: "#/components/schemas/AssistantValue"}
              after: {$ref: "#/components/schemas/AssistantValue"}
    AssistantValue:
      type: object
      additionalProperties: false
      properties:
        text: {type: string}
        amount: {type: string}
        currency: {type: string}
        date: {type: string, format: date}
```

  `status` `expired` is computed for a pending proposal past `expires_at` when returned; it is never stored. `result` is free JSON (`{}` schema).
  - Problems: 404 `proposal_not_found`, 409 `proposal_closed`, 409 `proposal_expired`, 409 `proposal_stale`, with the details of Appendix D.
  - Exposure entries: both operations `-llm`.

- [ ] **Step 1: Write the failing tests** in `proposal_test.go`. Add the harness option `apitest.ExtraTools(groups ...tool.Group)` (`internal/apitest/apitest.go`) and `server.Config.ExtraTools []tool.Group`, appended to the registry; production passes none, and tools from it join the chat set (Task 8). The test tool is `note_for_test` (`Write`, input `{text string}`): its handler increments an `atomic.Int64` counter and returns `{"ok":true}`; its preview returns `Preview{Action: "note_for_test", Changes: []Change{{Field: "description", After: TextValue(in.Text)}}, Basis: basis.Load()}`, where `basis` is an `atomic.Value` holding a string the test changes to simulate changed data. Its exposure test entry is not needed: extra tools are not in the production registry. Tests:
  - `TestProposeStoresPending` (S132): `svc.Propose` through the module test hook `assistant.ProposeForTest(ctx, userID, conversationID, name, args)` (exported in an `export_test.go` of package `assistant`) → content has `"status":"awaiting_confirmation"`; one row `pending`; counter 0.
  - `TestConfirmExecutesOnce` (S133): `POST /confirm` → 200, `status` `executed`, counter 1; second `POST /confirm` → 409 `proposal_closed`; counter 1.
  - `TestConfirmConcurrent`: two confirms in parallel goroutines → one 200, one 409 `proposal_closed`; counter 1.
  - `TestConfirmExpired` (S134): clock moved to `expires_at` (harness option `apitest.Clock` returning a settable clock; add when missing) → 409 `proposal_expired`; counter 0; `GET` of the conversation (Task 8) is not needed here.
  - `TestConfirmStale` (S135): basis variable changed after proposing → 409 `proposal_stale`; row `stale`; counter 0.
  - `TestRejectThenConfirm`: reject → 200 `rejected`; confirm → 409 `proposal_closed`.
  - `TestProposalOtherUser` (S136, part): user B confirming A's proposal → 404 `proposal_not_found`; A's row stays `pending`.
  - `TestConfirmToolFailure`: handler returns `tool.InvalidArgument("name", "exists")` → 200 `failed`, `result.code` `invalid_arguments`.
  - `TestChatSetRefusesWriteWithoutPreview`: `llmapi.NewChatSet` over a set with a `New` tool of effect `Write` → error containing its name.
- [ ] **Step 2: Run** `go test ./internal/assistant/...` — FAIL.
- [ ] **Step 3: Implement**; operations in `api/openapi.yaml`; `make gen`; handlers; exposure entries.
- [ ] **Step 4: Run** `go test ./internal/assistant/... ./internal/server/ -run 'Exposure|Contract'` — PASS.
- [ ] **Step 5: Commit** `feat(assistant): propose writes and execute them on confirmation`.

---

### Task 7: Guide, navigation map and `get_help`

Spec 9; ADR 020 C11.

**Files:**
- Create: `internal/assistant/internal/guide/guide.go`, `guide_test.go`, `articles/<topic>.md` (19 files, text of Appendix B)
- Create: `internal/assistant/internal/adapter/toolapi/toolapi.go`, `help.go`, `help_test.go`
- Create: `web/src/navigation/navigation-map.json` (Appendix C), `web/src/navigation/navigation-map.ts`, `web/src/navigation/navigation-map.test.ts`
- Modify: `web/embed.go` (add `//go:embed src/navigation/navigation-map.json` and `func NavigationMap() []byte`), `internal/assistant/assistant.go` (`Config.Navigation []byte`, `func (m *Module) Tools() tool.Group`), `internal/server/server.go` (pass `web.NavigationMap()`, add `assistantModule.Tools()` to the registry), `internal/server/tool_exposure_test.go`

**Interfaces:**
- Produces:
  - `guide.Topics() []string` (the 19 topics of Appendix A `get_help`, in that order); `guide.Article(topic string) (string, bool)`.
  - `type Screen struct { Path string \`json:"path"\`; Topics []string \`json:"topics"\`; Screen string \`json:"screen"\`; Tasks []string \`json:"tasks"\` }`; `guide.ParseMap(b []byte) ([]Screen, error)`: rejects a topic outside `Topics()` and a path not matching `^/[a-zA-Z0-9/$_-]*$`.
  - Tool `get_help` (Appendix A): output `{"topic": string, "article": string, "screens": [{"path","screen","tasks"}]}`.
  - `web/src/navigation/navigation-map.ts` exports `navigationMap: readonly NavigationScreen[]` and `matchScreen(path: string): NavigationScreen | undefined` (a `$name` segment matches one non-empty segment).

- [ ] **Step 1: Write the failing tests.**
  - `guide_test.go`: `TestArticlesExist` (each topic has an article of 200 to 3,000 bytes); `TestGuideTermsExistInGlossary`: every `**term**` of every article is, case-insensitively, a term in the first column of the tables of `../../../../docs/domain/02-ubiquitous-language.md` (read the file; the test lists missing terms with the article); `TestGuideTopicsHaveScreens`: `ParseMap(web.NavigationMap())` gives every topic except `budgets` at least one screen (Appendix C).
  - `help_test.go` (through `apitest`): `h.Tool("get_help", {"topic":"credit_cards_and_statements"})` → `topic` equal, `article` starts with Appendix B's first line of that article, `screens` contains `/cards` and `/cards/$accountId/statements/$statementId`; `{"topic":"budgets"}` → `screens` is `[]`; `{"topic":"nope"}` → `invalid_arguments`.
  - `navigation-map.test.ts`: every `path` is a full path of `routeTree` (collect `fullPath` from `routeTree` children recursively, drop a trailing slash except for `/`; `$param` segments compare literally); every route full path except `/login`, `/preview/account-card`, the `/accounts` layout itself (its index route stands for it) and the `_authed` id route is in the map; `matchScreen("/cards/3f2a/statements/9b1c")?.path === "/cards/$accountId/statements/$statementId"`; `matchScreen("/nope") === undefined`.
  - Exposure: the test now passes with `get_help` in `withoutOperation`.
- [ ] **Step 2: Run** `go test ./internal/assistant/... ./internal/server/` and `pnpm --dir web exec vitest run src/navigation` — FAIL.
- [ ] **Step 3: Implement**; articles and map copied verbatim from Appendices B and C.
- [ ] **Step 4: Run** the same commands plus `go test ./internal/server/ -run TestToolCatalog -update` and review the new `get_help` entry — PASS.
- [ ] **Step 5: Commit** `feat(assistant): answer from a product guide and a navigation map`.

---

### Task 8: The turn

Spec 5.3, 6, 10, 14; ADR 020 C2–C4, C12; scenarios S131, S137, S139–S141.

**Files:**
- Create: `internal/assistant/internal/app/turn.go`, `history.go`, `history_test.go`, `prompt.go`, `prompt_test.go`
- Create: `internal/assistant/internal/adapter/llmapi/turn.go`
- Create: `internal/assistant/internal/adapter/httpapi/turn.go`, `conversation.go`
- Create: `internal/assistant/turn_test.go`, `internal/assistant/conversation_test.go`
- Modify: `internal/assistant/assistant.go`, `internal/server/server.go`, `api/openapi.yaml`, `internal/server/tool_exposure_test.go`, `internal/apitest/apitest.go`

**Interfaces:**
- Consumes: Task 1 `llm.Run`, `llm.LoopOptions`; Task 5 `ChatState`; Task 6 `ChatHandlers`, `Propose`; Task 7 `LoadTools`, `guide`; `identity.Module.Profile` passed as `func(ctx, userID) (locale.Locale, error)` in `assistant.Config.Locale`.
- Produces:
  - `assistant.Config` gains `Tools tool.Set` (the chat set, selected in `internal/server` from every registry tool), `Locale func(context.Context, int64) (locale.Locale, error)`, `Navigation []byte`, `LLM *llm.Router`. Because the router is built after the module, `internal/server` calls `assistantModule.UseRouter(router)` after `llm.NewRouter`.
  - `const MaxSteps = 6`; `const TurnTimeout = 90 * time.Second`; `const WriteDeadline = 120 * time.Second`; `const HistoryBytes = 8000`; `const HistoryTurns = 6`.
  - `func History(messages []domain.Message, proposals []domain.Proposal, now time.Time) []HistoryMessage` (`HistoryMessage{Role domain.Role; Text string}`): the rule of spec 5.3; proposal lines are appended to the assistant message they belong to, as `\n[proposal <id> <tool>: <status>]` with `expired` for an expired pending proposal.
  - `func Prompt(p PromptInput) string` with `PromptInput{Today time.Time; Locale locale.Locale; Page string}`; the template of Appendix D.
  - `type TurnEvents interface { Turn(conversationID, messageID uuid.UUID); Step(tool string); Answer(m AnsweredMessage); Error(err error) }`
  - `func (s *Service) Turn(ctx context.Context, userID int64, in TurnInput, ev TurnEvents) error` with `TurnInput{ConversationID uuid.UUID (Nil: new); Text, Page string}`. Order: validate text (1–4,000 runes after trimming) → load or create the conversation (`ErrConversationNotFound`) → `ChatState`; not available with `RetryAt` → `*LimitError`; not available without → `ErrChatUnavailable` → store the user message, `ev.Turn` → build request (prompt, history, user text; declarations: every tool of the chat set, sorted by name, delivery A of spec 7.3) → `llm.Run(ctx with TurnTimeout, client, req, handlers, LoopOptions{MaxSteps, ForceAnswer: true, Pin: true, OnToolCall: ev.Step with the call's name, OnRestart: discard proposals created so far})` → on success store the assistant message (outcome `answered` or `step_limit`, content = answer text trimmed to `MaxAnswer` runes, possibly empty: Appendix D4), attach the turn's proposals, `ev.Answer` → on error `ev.Error` mapped per spec 6.2, no assistant message, and discard the turn's pending proposals.
  - Log `assistant turn` with the fields of spec 14 at the end of each turn.
  - Operations (tag `assistant`), schemas in `api/openapi.yaml`:

| Operation | Method and path | Response |
|---|---|---|
| `sendAssistantMessage` | `POST /assistant/turns` body `AssistantTurnInput {conversation_id?: uuid, text: string minLength 1 maxLength 4000, page?: string pattern "^/[A-Za-z0-9/_$.-]{0,199}$"}` | 200 `text/event-stream` (schema `type: string`); 404, 429, 503 problems |
| `listAssistantConversations` | `GET /assistant/conversations?limit&cursor` | 200 `{items: [AssistantConversation], next_cursor?}`; `AssistantConversation {id, title, created_at, updated_at}` |
| `getAssistantConversation` | `GET /assistant/conversations/{id}` | 200 `AssistantConversationDetail {id, title, created_at, updated_at, messages: [AssistantMessage]}`; `AssistantMessage {id, role: user|assistant, content, outcome?: answered|step_limit|failed, created_at, proposals: [AssistantProposal]}` |
| `deleteAssistantConversation` | `DELETE /assistant/conversations/{id}` | 204; 404 `conversation_not_found` |
| `deleteAssistantConversations` | `DELETE /assistant/conversations` | 204 |

  The turn handler is registered on the mux outside the strict server (it streams): it reads the body with the contract-validated schema, maps pre-stream errors to problems (`assistant_exhausted` 429 with `retry_at`, `assistant_unavailable` 503, `conversation_not_found` 404, `invalid_request` 400 for text over 4,000 runes after trimming), then writes `Content-Type: text/event-stream`, `Cache-Control: no-store`, sets `http.NewResponseController(w).SetWriteDeadline(now + WriteDeadline)`, and writes events as `event: <name>\ndata: <json>\n\n`, flushing after each. Exposure entries: the five operations `-llm`.

- [ ] **Step 1: Write the failing tests.**
  - `history_test.go`, `TestHistory`: 8 turns of 500-byte texts → the latest 6 turns (12 messages); turns of 3,000 bytes → the latest 2 turns (the third would pass 8,000); an assistant message with proposals `executed` and pending-expired → its text ends with `[proposal <id> record_transaction: executed]` and `[proposal <id> void_transaction: expired]`.
  - `prompt_test.go`, `TestPrompt`: with `Today` 2026-10-23, locale `pt`/`BR`, page `/cards` → the output equals Appendix D's template rendered with those values (store the expected text in `testdata/prompt_pt_BR.txt` and compare bytes); with an empty page, the page sentence is absent.
  - `turn_test.go` through `apitest` with `apitest.LLMFactory` and a user `gemini` provider served by an `llmtest.Provider`, reading the SSE body as text and splitting events:
    - `TestTurnRead` (S131): steps `calls(get_balances {})`, `text("Saldo: R$ 10,00")` → events `turn`, `step` (`{"tool":"get_balances"}`), `answer` with `content` "Saldo: R$ 10,00" and `outcome` `answered`; `GET` the conversation → two messages; the first request's `System` equals `Prompt(...)`; its `Tools` hold the 36 tool names of spec 7.2 plus none other.
    - `TestTurnProposal` (S132 through the turn): `apitest.ExtraTools` with Task 6's `note_for_test`; steps `calls(note_for_test {"text":"x"})`, `text("Confirme no cartão.")` → `answer.proposals[0].status` `pending` and `answer.proposals[0].tool` `note_for_test`.
    - `TestTurnExhausted` (S137): the provider's target cooling before the turn → 429 `assistant_exhausted` with `retry_at`, provider received 0 requests, no message stored.
    - `TestTurnUnavailable`: no provider → 503 `assistant_unavailable`.
    - `TestTurnFallback` (S139): user chain with two providers `p1`, `p2` (`setUseChain`); `p1` steps `calls(get_balances)`, then `QuotaError`; `p2` steps `calls(get_balances)`, `text("ok")` → one `answer` "ok", log `assistant turn` with `restarted=true`.
    - `TestTurnStepLimit` (S140): six `calls(get_balances)` responses → sixth request has `ToolChoice` none, answer outcome `step_limit`.
    - `TestTurnFailed`: provider returns `llm.ErrInvalidRequest` → event `error` with code `assistant_failed`; the conversation holds only the user message.
    - `TestTurnClientDisconnect`: a provider step that blocks until the request context ends; cancel the client request after the `turn` event → the handler returns, no assistant message stored, log outcome `canceled`.
    - `TestTurnLogsNoContent`: after `TestTurnRead`'s flow, `h.Logs()` contains `msg="assistant turn"` with `steps=2` and `tool_calls=1`, and contains neither the user text nor "R$ 10,00".
    - `TestTurnOtherUserConversation` (S136): user B sending to A's conversation → 404 `conversation_not_found`.
  - `conversation_test.go`: list order and paging (limit 1 then cursor); `DELETE` one → 204, `GET` → 404; `DELETE` all for A leaves B's conversations (S141); title is `domain.Title` of the first message.
- [ ] **Step 2: Run** `go test ./internal/assistant/... ./internal/platform/llm/...` — FAIL.
- [ ] **Step 3: Implement**; operations; `make gen`; exposure entries; wire `internal/server/server.go`: select every registry tool into the chat set, pass `identityModule.Profile`, `web.NavigationMap()`, and call `UseRouter(router)`.
- [ ] **Step 4: Run** `go test ./internal/assistant/... ./internal/platform/llm/... ./internal/server/` — PASS.
- [ ] **Step 5: Commit** `feat(assistant): run conversation turns with streamed progress`.

---

Tasks 9 to 18 are in `docs/superpowers/plans/2026-10-23-assistant-chat/tools.md`.

---

### Task 19: Web API layer and conversation state

Spec 12; ADR 018; `web/CLAUDE.md`.

**Files:**
- Create: `web/src/features/assistant/api.ts`, `api.test.ts`, `sse.ts`, `sse.test.ts`, `index.ts`
- Generated: `web/src/api/schema.gen.ts` (by `make gen` in Task 5, 6, 8; do not edit)

**Interfaces:**
- Produces:
  - `parseEvents(chunk: string, carry: string): { events: AssistantEvent[]; carry: string }` in `sse.ts`, where `AssistantEvent = { type: "turn"; conversationId: string; messageId: string } | { type: "step"; tool: string } | { type: "answer"; message: AssistantMessage } | { type: "error"; problem: Problem }`.
  - `sendMessage(input: { conversationId?: string; text: string; page?: string }, onEvent: (e: AssistantEvent) => void, signal: AbortSignal): Promise<void>` in `api.ts`: `fetch("/api/v1/assistant/turns", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body, signal })`; a non-200 response is read as a problem and delivered as one `error` event; a 200 body is read with `getReader()` and `TextDecoder` through `parseEvents`.
  - Query options: `chatStateQuery(api)`, `conversationsQuery(api)`, `conversationQuery(api, id)`; mutations `confirmProposal`, `rejectProposal`, `deleteConversation`, `deleteConversations` (through `@/api/client`, allowed in `features/*/api.ts` by O3).
- [ ] **Step 1: Write the failing tests** (`sse.test.ts`): two events in one chunk; one event split across two chunks (carry); a `data:` line with JSON containing `\n` escaped; an unknown event name is ignored. `api.test.ts` (with the project's fetch mock helper in `src/testing`): a 429 problem becomes `{ type: "error", problem: { code: "assistant_exhausted", retry_at: "2026-10-24T00:00:00Z" } }`; a 200 stream delivers `turn`, `step`, `answer` in order.
- [ ] **Step 2: Run** `pnpm --dir web exec vitest run src/features/assistant` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and `pnpm --dir web exec tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(web): add the assistant api and event stream reader`.

### Task 20: Web assistant panel

Spec 12; skills `compose-screen` (write) then `review-screen` (self-review); `web/CLAUDE.md` rules O1–O10 and Slotted feedback.

**Files:**
- Create in `web/src/features/assistant/`: `assistant-panel.tsx`, `assistant-panel.module.css`, `assistant-panel.test.tsx`, `conversation-list.tsx`, `conversation-list.test.tsx`, `message-item.tsx`, `answer-markdown.ts`, `answer-markdown.test.ts`, `mask-amounts.ts`, `mask-amounts.test.ts`, `proposal-card.tsx`, `proposal-card.test.tsx`, `provider-notice.tsx`, `use-assistant-turn.ts`
- Modify: `web/src/app/shell/app-frame.tsx`, `top-app-bar.tsx`, `command-menu.tsx` (entry "Assistant"), `web/src/i18n/catalog.en.ts`, `catalog.pt-BR.ts` (keys of Appendix D)
- Modify: `docs/slotted-findings.md` when a finding is met

**Interfaces:**
- Consumes: Task 19 API; `navigationMap`, `matchScreen` (Task 7); `useMoneyFormat()`; Slotted families `message`, `message-scroller`, `prompt-composer`, `markdown`, `inline-message`, and the sheet or side panel family the `conversations` guideline names.
- Produces:
  - `parseAnswer(text: string): MarkdownNode` in `answer-markdown.ts`: an mdast tree for paragraphs, `-`/`*` and `1.` lists, `**bold**`, and `[label](/path)` links; any other syntax stays literal text. No new dependency (`marked` is not installed). Report the Slotted finding "The markdown family needs an outside parser for plain CommonMark" (kind `feature`, area `family — markdown`) in the task reply and in `docs/slotted-findings.md` with status `open`, and write the workaround comment in `answer-markdown.ts`.
  - `maskAmounts(tree: MarkdownNode, mask: (text: string) => string): MarkdownNode`: replaces every match of the amount pattern exported by `web/src/testing/privacy.ts` (export the pattern there if it is a local constant; the helper keeps using it) with `mask(match)`; `mask` returns the currency symbol of the match when one precedes the digits, followed by `••••`, mirroring `useMoneyFormat()` hidden output.
  - Link renderer: a link whose `matchScreen(href)` exists becomes a router `Link`; any other link renders its label as text.
- [ ] **Step 1: Write the failing tests.**
  - `answer-markdown.test.ts`: `"Total:\n\n- **Food** 10\n- [Cards](/cards)"` → a paragraph, a list of two items, a `strong`, a `link` with url `/cards`; `"[x](javascript:alert(1))"` → text containing `[x](javascript:alert(1))` and no link node; `"# Title"` → text `# Title`.
  - `mask-amounts.test.ts`: `"Gastou R$ 1.234,56 em outubro"` → `"Gastou R$ •••• em outubro"`; `"$1,234.56"` → `"$ ••••"` or the exact mask string `useMoneyFormat()` produces for USD in `en-US` when hidden (assert against the hook's output, not a literal); `"1234.56 BRL"` → masked; `"2026-10-23"` unchanged; `"3 transações"` unchanged.
  - `proposal-card.test.tsx`: a pending proposal renders action label, target, each change `before → after`, Confirm and Reject; Confirm calls `confirmProposal` once and disables both buttons while pending; statuses `executed`, `stale`, `expired` render their labels and no buttons; with privacy on, `expectNoAmounts(container)` passes.
  - `assistant-panel.test.tsx`: before the first message the notice shows provider and model and, for `trains`, the Appendix D sentence; `available: false` with `retry_at` disables the composer and shows the time; sending a message shows the step line for `step` events and the answer for `answer`; an `assistant_exhausted` error event shows the time of return; with privacy on, `expectNoAmounts` passes over an answer containing "R$ 1.234,56"; a link to `/cards` navigates through the router.
  - `conversation-list.test.tsx`: newest first; delete one calls `deleteConversation`; delete all asks for confirmation first.
- [ ] **Step 2: Run** `pnpm --dir web exec vitest run src/features/assistant` — FAIL.
- [ ] **Step 3: Implement** following `compose-screen`; texts from Appendix D through `useT()`; CSS in `*.module.css` inside `@layer app` reading only `var(--slotted-*)`.
- [ ] **Step 4: Run** `make web-check` and `pnpm --dir web exec vitest run src/features/assistant src/app` — PASS. Then run the `review-screen` skill over the panel and fix its findings.
- [ ] **Step 5: Commit** `feat(web): add the assistant panel with proposals and provider notice`.

### Task 21: Documentation

**Files:**
- Modify: `docs/domain/06-scenarios.md` (new section `## 6.20 Assistant` with S131–S142 copied from spec 16, each with the test name that covers it), `docs/web-roadmap.md` (item 16 status "Delivered" with the routes and functions; Summary row 16 "Delivered"; item 14 unchanged), `docs/adr/020-assistant-conversation.md` (status `accepted`), `docs/adr/012-tool-registry.md` (line "Amended by ADR 020: T9, T10, T14"), `docs/contributing/regions.md` (unchanged: verify no row is needed and state nothing)
- Create: `docs/assistant-eval/README.md` (how to run Task 22's evaluation, the thresholds of spec 13.2, a results table filled in Task 24)
- [ ] **Step 1:** Write the sections; every scenario names an existing test (`grep -rn "S13[1-9]\|S14[0-2]" internal/` lists them).
- [ ] **Step 2:** `go test ./internal/... -run 'S13|S14' -list .` shows each named test.
- [ ] **Step 3: Commit** `docs: record the assistant scenarios, roadmap and decision`.

### Task 22: Real evaluation harness

Spec 13.2; Appendix E.

**Files:**
- Create: `internal/assistant/eval_test.go` (`//go:build eval`), `internal/assistant/evalseed_test.go` (`//go:build eval`), `internal/assistant/testdata/eval/tasks.json` (Appendix E tasks verbatim)

**Interfaces:**
- Produces: `TestAssistantEval` reading `EQUORI_EVAL_PROVIDER` (preset), `EQUORI_EVAL_MODEL`, `EQUORI_EVAL_KEY`, `EQUORI_EVAL_BASE_URL` (optional), `EQUORI_EVAL_K` (default 3), `EQUORI_EVAL_OUT` (default `../../docs/assistant-eval/<date>-<preset>-<model>.json`, model with `/` replaced by `_`); for each task and trial: a fresh `apitest.New`, the seed of Appendix E, a provider created through `createProvider`, a chain for `assistant.chat` set to it, the turn through `POST /api/v1/assistant/turns`, confirmation of proposals when the task says so, then the grader. Spacing between model calls: `EQUORI_EVAL_RPM` (default 8) requests per minute, enforced by a wrapper `llm.Provider` around the real one in the factory. A quota error with daily reset stops the run and writes the partial file with `"stopped":"daily_quota"`.
- Output JSON: `{"date","provider","model","k","tasks":[{"id","trials":[{"success","steps","input_tokens","output_tokens","latency_ms","failure"}]}],"summary":{"success_rate","pass_k","adversarial_pass","mean_steps","p95_latency_ms","mean_input_tokens","thresholds_met"}}`.
- Thresholds of spec 13.2 are constants in `eval_test.go`; the test fails when `thresholds_met` is false.
- [ ] **Step 1:** Write `evalseed_test.go` and `tasks.json`; `go vet -tags eval ./internal/assistant/` passes.
- [ ] **Step 2:** Run with a `llmtest` provider through `EQUORI_EVAL_PROVIDER=llmtest` (a test-only preset path in the harness that scripts the expected tool calls of task E01) to prove the harness and grader: `go test -tags eval -run TestAssistantEval/E01 ./internal/assistant/` PASS.
- [ ] **Step 3: Commit** `test(assistant): add the real evaluation harness and tasks`.

### Task 23: Reviews (main session)

- [ ] **Step 1: Descriptions and outputs** against spec 7.1 and the references of spec 17: read `internal/server/testdata/tools.json`; for each tool, check "Use"/"Do not use" pairs name existing tools, outputs carry names beside IDs, no unused IDs; run `go test ./internal/server/ -run TestToolOutputBudget` (added in Task 9) — PASS.
- [ ] **Step 2: Security** (OWASP LLM01, LLM06): every write tool is built with `NewWrite`; `llmapi.NewChatSet` refuses otherwise; no handler path executes a write from `ChatHandlers`; the system prompt carries the untrusted-text paragraph; S142 test passes; `grep -rn "slog" internal/assistant | grep -i "args\|content\|text"` shows no logging of arguments or text.
- [ ] **Step 3: Isolation**: every new query has `user_id = $` (grep `db/queries/assistant/*.sql`); every tool test file has its `OtherUser` test; S136 passes.
- [ ] **Step 4:** Remove `-write` and `-pending` from `exclusions`; `go test ./internal/server/ -run TestToolExposure` — PASS (no entry uses them).
- [ ] **Step 5: Commit** fixes found, one commit per fix, and `test(api): retire the write and pending exposure reasons`.

### Task 24: Final validation (main session)

Run each item of the acceptance matrix of the task prompt and record the output in the final report.

- [ ] `make check` — PASS; `lefthook run pre-commit` and `lefthook run pre-push` — PASS.
- [ ] `go test ./internal/server/ -run TestToolExposure -v | grep -c pending` → 0.
- [ ] `go test ./internal/server/ -run TestToolCatalog -update`; `git diff --stat internal/server/testdata/tools.json` reviewed; `EQUORI_GEMINI_API_KEY=… EQUORI_GEMINI_LIVE_MODEL=gemini-3.5-flash-lite go test -tags live -run TestToolsLive ./internal/server/` — PASS.
- [ ] Evaluation, Gemini free: `EQUORI_EVAL_PROVIDER=gemini EQUORI_EVAL_MODEL=gemini-3.5-flash-lite EQUORI_EVAL_KEY=… go test -tags eval -run TestAssistantEval -timeout 90m ./internal/assistant/` — thresholds met, file under `docs/assistant-eval/`.
- [ ] Evaluation, second provider (`groq` with `EQUORI_GROQ_API_KEY`, model `openai/gpt-oss-120b`), when the key exists; otherwise the report marks item 9 pending.
- [ ] Browser: a Playwright script in the session scratchpad (`launch()` with `executablePath` from `~/.cache/ms-playwright`, closed in `finally`), against `make run-prod` with an `llmtest`-free real provider, four scenarios: read question, navigation help, write with confirmation, exhausted quota (a declared limit of 1 request reached); at most four screenshots.
- [ ] Greps: `grep -rn "float64" internal/assistant internal/*/internal/adapter/toolapi` → none for amounts; new tables have `user_id`; `git log --name-only` shows no edited applied migration.
- [ ] Write `.claude/progress/current.md` final state and the final report (prompt section 12).
