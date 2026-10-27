# Assistant phase 1: panel correctness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A failed, stopped or transient-failed turn leaves the panel usable: no welcome flash, no false "usage limit", a stored failed answer with a retry, the composer re-enabled at `retry_at`, focus on the composer, and the conversation kept across a reload.

**Architecture:** The engine stores an assistant message for every turn that stored a user message (outcomes `failed`, `canceled`), waits once for a transient cooldown, and persists only quota cooldowns. The panel writes the `answer` event into the conversation cache, reads blocking state only from `GET /assistant/chat`, and keeps the open conversation in `sessionStorage`.

**Tech Stack:** Go 1.26, PostgreSQL, goose, sqlc, oapi-codegen; React, TanStack Query and Router, Slotted 0.1.0-beta.16, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-mcp-agent-design.md` (sections 2.2, 2.4, 4.1, 4.4, 4.8, 4.9). Study: `docs/superpowers/specs/2026-10-26-mcp-agent-study.md` (U*, D*).

## Global Constraints

- Phase 1 changes no system prompt text; the evaluation of ADR 020 C13 is not run after it. Agents never run `-tags eval` or `-tags live`.
- Applied migrations are never edited; a schema change is a new goose migration with the next free number in `db/migrations/` at execution time (00061 when no other change has taken it).
- A test changes only when the specified behavior changes; the commit body names the spec rule (E11, E7).
- UI text comes from both catalogs (`web/src/i18n/catalog.en.ts`, `catalog.pt-BR.ts`); no literal text in JSX (O6).
- `web/src/features/setup/*` and both catalogs carry uncommitted work of another session; stage only the hunks of this plan (`git add -p`).
- Each task ends with the package tests of the changed files passing; the phase ends with `make check`.

## Review Focus

1. A turn canceled by the client after the answer was generated: the answer is stored as `answered`, never as `canceled` (existing `storeCtx` rule). Test in Task 1.
2. A transient failure on one of three chain targets falls through to the next target without any wait. Test in Task 2.
3. A quota cooldown followed by a transient failure on the same target stays a quota cooldown (`assistant_exhausted` with `retry_at`). Test in Task 2.
4. A conversation ID in `sessionStorage` that the server answers 404 for (deleted conversation, other user in the same tab) opens a new conversation, not an error. Test in Task 6.
5. A retry while a turn runs is refused like any send during a turn. Test in Task 4.

---

### Task 1: Store failed and canceled turns (E11, E12, U5)

**Files:**
- Create: `db/migrations/00061_assistant_message_canceled.sql`
- Modify: `internal/assistant/internal/domain/conversation.go` (outcome constants)
- Modify: `internal/assistant/internal/app/turn.go:192-212` (error branch of `Turn`)
- Modify: `internal/assistant/internal/app/history.go` (failed and canceled exchanges)
- Modify: `api/openapi.yaml` (`AssistantMessage.outcome` enum), then `make gen`
- Modify: `docs/adr/020-assistant-conversation.md` (Amendments)
- Test: `internal/assistant/turn_test.go`, `internal/assistant/schema_test.go`, `internal/assistant/internal/app/history_test.go`

**Interfaces:**
- Produces: `domain.OutcomeCanceled Outcome = "canceled"`; API outcome values `answered`, `step_limit`, `failed`, `canceled`; `app.NoAnswer = "[no answer]"`.

- [ ] **Step 1: Change the two tests whose behavior E11 changes, add the schema and history cases**

`TestTurnFailed`: after the existing event assertions, the conversation holds two messages:
```go
msgs := conversationMessages(t, h, turn.ConversationID)
if len(msgs) != 2 || msgs[0].Role != "user" || msgs[1].Role != "assistant" || msgs[1].Outcome != "failed" || msgs[1].Content != "" {
	t.Fatalf("messages = %+v", msgs)
}
```
`TestTurnClientDisconnect`: the assistant count becomes 1 and its outcome `canceled`:
```go
var outcome string
if err := h.Pool.QueryRow(t.Context(), `SELECT outcome FROM assistant_message WHERE role = 'assistant'`).Scan(&outcome); err != nil || outcome != "canceled" {
	t.Fatalf("assistant outcome = %q, %v", outcome, err)
}
```
Rename its comment to "Review focus 2, amended by E11: a disconnect stops the turn and stores a canceled answer."
`TestSchema`: `add("assistant message canceled", msg(a, "assistant", "", "canceled"), nil)` (accepted) and `add("assistant message unknown outcome", msg(a, "assistant", "", "lost"), checkViolation)`, in the style of the existing cases.
`TestHistory`, new subtest "failed and canceled exchanges":
```go
msgs := turns(2, 3, 3)
msgs[1].Content, msgs[1].Outcome = "", domain.OutcomeFailed
msgs[3].Content, msgs[3].Outcome = "", domain.OutcomeCanceled
got := app.History(msgs, nil, now)
// want 4 messages; got[1].Text == "[no answer]" and got[3].Text == "[no answer]"
```

- [ ] **Step 2: Run them and read the failures**

Run: `go test ./internal/assistant/... -run 'TestTurnFailed|TestTurnClientDisconnect|TestSchema|TestHistory' -count=1`
Expected: FAIL — one stored message, no `canceled` in the check constraint, history drops the empty exchanges.

- [ ] **Step 3: Migration**

`00061_assistant_message_canceled.sql`: Up drops `assistant_message_outcome_check` and adds it back with `outcome IN ('answered', 'step_limit', 'failed', 'canceled')`; Down deletes rows with outcome `canceled`, then restores the three-value check.

- [ ] **Step 4: Store the message in `Service.Turn`**

In the `err != nil` branch after `s.agent.Run`, before `ev.Error` or the `canceled` return, append an assistant message with `Outcome` `domain.OutcomeFailed` or `domain.OutcomeCanceled`, empty `Content`, through `context.WithoutCancel(ctx)`. Outcomes `exhausted` and `unavailable` from inside the run also store `failed`: the message records that the user's text got no answer. A storage failure is logged with `s.log.ErrorContext` and does not change the event sent. `outcomeCancel` keeps returning `nil` without `ev.Error`.

- [ ] **Step 5: History**

In `History`, an assistant message whose outcome is `failed` or `canceled` contributes `NoAnswer` as its text (declare `const NoAnswer = "[no answer]"` in `history.go`); proposal lines still append.

- [ ] **Step 6: API enum and generated code**

`api/openapi.yaml`: `outcome: {type: string, enum: [answered, step_limit, failed, canceled]}`. Run `make gen`.

- [ ] **Step 7: Run the tests**

Run: `go test ./internal/assistant/... -count=1`
Expected: PASS.

- [ ] **Step 8: ADR 020 amendment**

Under Amendments: "C2, C3 (design 2026-10-26 E11, E12): a turn that stored its user message and ends without an answer stores an assistant message with outcome `failed` or, when the request context ended, `canceled`, and empty content. History renders such an exchange as the user text followed by `[no answer]`."

- [ ] **Step 9: Commit**

```bash
git add db/migrations/00061_assistant_message_canceled.sql internal/assistant api/openapi.yaml web/src/api/schema.gen.ts docs/adr/020-assistant-conversation.md
git commit -m "feat(assistant): store failed and canceled turns"
```
Body names E11 and E12 and the two amended tests.

---

### Task 2: A transient failure waits once and never reports a usage limit (E6, E7, U3)

**Files:**
- Modify: `internal/platform/llm/router.go` (cooldown kind), `internal/platform/llm/errors.go` (`ExhaustedError.Transient`)
- Modify: `internal/assistant/internal/app/usage.go` (`Record`)
- Modify: `internal/assistant/internal/adapter/llmapi/turn.go` (wait and second run, `mapError`)
- Modify: `internal/assistant/assistant.go` (`Config.Wait`, default), `internal/server/server.go` (`Config.LLMWait`), `internal/apitest/apitest.go` (option `LLMWait`)
- Modify: `docs/adr/020-assistant-conversation.md` (C10 amendment)
- Test: `internal/platform/llm/router_test.go`, `internal/assistant/internal/adapter/llmapi/turn_test.go` (new, package `llmapi`), `internal/assistant/turn_test.go`

**Interfaces:**
- Produces: `llm.ExhaustedError{RetryAt time.Time; Transient bool}`; `app.AgentRequest.Deadline time.Time`, set by `Service.Turn` to `now.Add(TurnTimeout)` on the instance clock; `llmapi.NewAgent(client *llm.Client, svc *app.Service, tools app.Tools, set tool.Set, wait func(ctx context.Context, until time.Time) error) *Agent`; `assistant.Config.Wait`, `server.Config.LLMWait` and `apitest.LLMWait(f func(context.Context, time.Time) error) Option` with the same function type. A nil wait uses a timer to `until`, measured with the instance clock.

- [ ] **Step 1: Router test**

`TestClientGenerate` gains cases (or a new `TestExhaustedTransient`), with the fixture clock:
- one target, `Err: fmt.Errorf("x: %w", llm.ErrTransient)` → `*llm.ExhaustedError` with `Transient == true` and `RetryAt == start.Add(10*time.Second)`.
- one target, `&llm.QuotaError{RetryAfter: time.Minute}` → `Transient == false`.
- quota on target A at `start`, then at `start+1s` a call where A is skipped as cooling and B fails transient → `Transient == false` (one quota cooldown blocks).
- quota cooldown on A, then A's cooldown is set again by a transient failure before it ends (call with `Pin` to A after moving the clock past nothing) → `Transient == false` (Review Focus 3).
- three targets, the first fails transient, the second answers → the response of the second, no error, and the third is not called (Review Focus 2).

- [ ] **Step 2: Run it**

Run: `go test ./internal/platform/llm -run 'TestClientGenerate|TestExhaustedTransient' -count=1`
Expected: FAIL — `Transient` undefined.

- [ ] **Step 3: Implement the cooldown kind**

`Router.cooldown` becomes `map[Target]cooldown` with `type cooldown struct { until time.Time; quota bool }`. `setCooldown(t, until, quota)`: a later `until` replaces the entry and keeps `quota` true when the replaced entry was a quota cooldown still running. `Generate` returns `&ExhaustedError{RetryAt: r.earliestEnd(bindings), Transient: r.allTransient(bindings)}`; `allTransient` is true when every binding's running cooldown has `quota == false`. The pinned-target branch (`req.Pin` set, no binding) keeps `Transient: false`.

- [ ] **Step 4: Router tests pass**

Run: `go test ./internal/platform/llm -count=1` — PASS.

- [ ] **Step 5: Agent test (package `llmapi`, internal)**

`TestAgentWaitsOnceForTransient` builds `llm.NewRouter` over an `llmtest.Provider` and a clock the test moves, an `Agent{client: router.Client(target), handlers: map[string]llm.ToolHandler{}, wait: fake}` where `fake` records `until` and sets the clock to it. Cases:
- steps `[transient, text "ok"]` → result text `"ok"`, `err == nil`, `fake` called once with `start+10s`.
- steps `[transient, transient]` → `errors.Is(err, app.ErrTurnFailed)` and not a `*app.LimitError`; `fake` called once.
- `AgentRequest.Deadline` = `start+5s`, steps `[transient]` → `fake` never called, `errors.Is(err, app.ErrTurnFailed)`.
- steps `[quota 1h]` → `*app.LimitError` with `RetryAt == start+1h`; `fake` never called.
The other cases set `AgentRequest.Deadline` to `start+90s`.

- [ ] **Step 6: Run it**

Run: `go test ./internal/assistant/internal/adapter/llmapi -count=1` — FAIL.

- [ ] **Step 7: Implement the wait in `Agent.Run`**

Extract the current body into `run`. After it: when the error is an `*llm.ExhaustedError` with `Transient` and `RetryAt` is before `in.Deadline`, call `onRestart()` (discards proposals of the failed attempt), then `wait(ctx, RetryAt)`, then `run` once more; tool-call counts and usage of both runs add up. `mapError`: an `*llm.ExhaustedError` with `Transient` maps to `fmt.Errorf("%w: %w", app.ErrTurnFailed, err)`; without it, to `*app.LimitError` as today.

- [ ] **Step 8: Persist only quota cooldowns (E7)**

`Service.Record` passes `CoolingUntil` to `AddUsage` only when `a.Outcome == "quota"`; any other outcome stores the zero time.

- [ ] **Step 9: Wiring**

`assistant.Config.Wait`, `server.Config.LLMWait` and `apitest.LLMWait` carry the function to `llmapi.NewAgent`; a nil value uses `time.NewTimer(until.Sub(clk.Now()))` with a `select` on `ctx.Done()`.

- [ ] **Step 10: API test (U3)**

`TestTurnTransientIsNotALimit` in `internal/assistant/turn_test.go`: `turnHarness` with three `llmtest` steps that fail with `fmt.Errorf("500: %w", llm.ErrTransient)` for `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.5-flash` (the default chain order of TestTurnExhausted), then `textStep("ok")` for `chatModel`, and `apitest.LLMWait` with a function that records `until` and returns nil while the harness clock (`apitest.Clock` over a variable) is moved to `until`. Assertions: status 200, events `turn`, `answer`; answer content `"ok"`; `GET /api/v1/assistant/chat` answers `available: true`; the wait ran once. A second case primes the three targets with transient errors through `h.App.LLM.Use(assistant.ChatUse).Generate` (as TestTurnExhausted does), then `sendTurn` answers 200, not 429.

- [ ] **Step 11: Run**

Run: `go test ./internal/assistant/... ./internal/platform/llm/... -count=1` — PASS, including the unchanged `TestTurnExhausted`.

- [ ] **Step 12: ADR 020 amendment and commit**

Amendment: "C10 (design 2026-10-26 E6, E7): only a quota cooldown or a daily limit makes a turn answer `assistant_exhausted`. A turn whose every target cools down from transient failures waits once for the earliest end inside its deadline and calls again; a turn that still fails ends with `assistant_failed`."
```bash
git add internal/platform/llm internal/assistant internal/server/server.go internal/apitest/apitest.go docs/adr/020-assistant-conversation.md
git commit -m "fix(assistant): wait out a transient failure instead of reporting a limit"
```

---

### Task 3: Answer from the event; the header names the first question (P1, U1, U13)

**Files:**
- Modify: `web/src/features/assistant/use-assistant-turn.ts`
- Modify: `web/src/features/assistant/assistant-panel.tsx` (title)
- Test: `web/src/features/assistant/assistant-panel.test.tsx`

**Interfaces:**
- Consumes: `assistantKeys.conversation(id)`, `AssistantMessage` (outcome now includes `canceled`).
- Produces: `AssistantTurn` keeps its shape; `pending` clears only after the cache holds the answer.

- [ ] **Step 1: Failing tests**

`it("never shows the welcome between the first turn event and the answer (U1)")`: the conversation route returns a promise the test resolves last; write `turn`, then `answer`, close the stream; assert `screen.queryByText(catalogEn["assistant.welcome.title"])` is null and `findByText("10 items")` resolves, both before the route promise resolves; a `MutationObserver` on `document.body` started before `ask` records whether a node with the welcome title text was ever added after the `turn` event — expected never.
`it("names the conversation after the question while the first turn runs (U13)")`: after `ask("How much?")` and the `turn` event, the drawer description reads `How much?`, not `New conversation`.

- [ ] **Step 2: Run** `pnpm vitest run src/features/assistant/assistant-panel.test.tsx` from `web/` — FAIL.

- [ ] **Step 3: Implement**

In `onEvent`, on `answer`: `queryClient.setQueryData(assistantKeys.conversation(id), (old) => ...)` appending the user message (`id` = the `turn` event's `messageId`, `role: "user"`, `content: text`, `created_at: new Date().toISOString()`, `proposals: []`) and `event.message`; for a conversation without cached data the object is `{ id, title: text, created_at, updated_at, messages: [user, answer] }`. Then clear `pending`. The existing `invalidateQueries` stays and runs after. The panel's title uses `turn.pending` while `stored.data` is undefined and `turn.pending !== null`.

- [ ] **Step 4: Run** — PASS, with the existing panel tests.

- [ ] **Step 5: Commit** `fix(web): render the assistant answer from the stream event`

---

### Task 4: Failed answers retry; limits re-enable; no-provider notice links settings (P6, P7, P8; U4, U5, U14)

**Files:**
- Modify: `web/src/features/assistant/message-item.tsx` (props `onRetry?: () => void`)
- Modify: `web/src/features/assistant/assistant-panel.tsx` (blocking state, notice, retry wiring)
- Create: `web/src/features/assistant/use-retry-at.ts` (`useRetryAt(retryAt: string | undefined, onPass: () => void): void`)
- Modify: both catalogs
- Test: `web/src/features/assistant/assistant-panel.test.tsx`

**Interfaces:**
- Consumes: outcomes `failed`, `canceled` from Task 1.
- Produces: catalog keys `assistant.no_answer` ("No answer from the provider" / "Sem resposta do provedor"), `assistant.canceled` ("Stopped" / "Interrompida"), `assistant.retry` ("Try again" / "Tentar de novo"), `assistant.setup` ("Set up the assistant" / "Configurar o assistente"), `assistant.unavailable.body` (one sentence: the assistant needs a language model provider).

- [ ] **Step 1: Failing tests**

- `it("offers a retry on a failed answer that sends the same text (U5, P6)")`: conversation `c1` whose last message is `{role: "assistant", content: "", outcome: "failed"}` after user text `How much?`; clicking `Try again` posts `{conversation_id: "c1", text: "How much?"}` to `/api/v1/assistant/turns` (assert on the captured request body).
- `it("shows the stop on a canceled answer")`: outcome `canceled` renders `Stopped` and `Try again`.
- `it("re-enables the composer when retry_at passes (U4, P7)")`: `vi.useFakeTimers({ toFake: ["setTimeout", "Date"] })`, `vi.setSystemTime("2026-10-23T10:00:00Z")`; chat state answers `{available: false, retry_at: "2026-10-23T10:01:00Z"}` first and `chat` afterwards; the composer is disabled; `vi.advanceTimersByTime(60_000)`; the composer is enabled.
- `it("does not block after a failed turn event")`: a stream with `turn` then `error` `assistant_failed`; afterwards the composer is enabled and no `Usage limit reached` text exists.
- `it("links the settings when no provider serves the assistant (U14, P8)")`: chat state `{available: false}`; a button `Set up the assistant`; clicking it calls `navigate` with `{ to: "/settings", search: { section: "assistant" } }` and `onOpenChange(false)`; no element with `data-tone="danger"` in the panel.
- Review Focus 5: while a turn runs (stream open), clicking `Try again` on an older failed message sends nothing (one POST captured).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

- `MessageItem`: for outcome `failed` or `canceled` render no bubble; render `Text` with `assistant.no_answer` or `assistant.canceled`, and, when `onRetry` is given, a `Button` (`variant="outline"`, `size="sm"`) with `assistant.retry`. The `failed` danger `Alert` is removed.
- Panel: the last message, when failed or canceled, gets `onRetry={() => send(previousUserText)}`; `send` ignores calls while `turn.pending !== null`.
- `blocked = chat.data?.available === false`. The notice reads `chat.data` only: `retry_at` set → warning `Alert` with `assistant.exhausted.title` and `assistant.exhausted`; unset → `Alert tone="info"` with `assistant.unavailable.title`, `assistant.unavailable.body` and `AlertActions` holding the `assistant.setup` button. `turn.error` shows an alert only for codes other than `assistant_exhausted`, `assistant_unavailable`, `assistant_failed` (through `problemMessage`).
- `useRetryAt(chat.data?.retry_at, () => queryClient.invalidateQueries({ queryKey: assistantKeys.chat() }))`: one `setTimeout` to the instant, cleared on change and unmount; an instant in the past fires at once.

- [ ] **Step 4: Run** — PASS; then `pnpm vitest run src/features/assistant`.

- [ ] **Step 5: Commit** `fix(web): retry a failed assistant answer and re-enable after a limit`

---

### Task 5: Focus moves to the composer and back (P18, U7)

**Files:**
- Modify: `web/src/features/assistant/assistant-panel.tsx` (props `returnFocus: RefObject<HTMLElement | null>`; `initialFocus`, `finalFocus`)
- Modify: `web/src/features/assistant/assistant-composer.tsx` (accepts `inputRef: RefObject<HTMLTextAreaElement | null>`)
- Modify: `web/src/app/shell/app-frame.tsx` (`openAssistant` records `document.activeElement`)
- Test: `web/src/features/assistant/assistant-panel.test.tsx`, `web/src/app/shell/app-frame.test.tsx`

- [ ] **Step 1: Failing tests**

- Panel: on open, `document.activeElement` is the textbox named by `assistant.composer.placeholder`.
- App frame: focus a button on the page, press `a`, the composer has focus; press Escape; focus returns to that button (not `document.body`).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`Drawer` gets `initialFocus={composerRef}` and `finalFocus={returnFocus}`. `AppFrame` holds `const returnTo = useRef<HTMLElement | null>(null)`; `openAssistant` sets `returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null` before opening. When the history list replaces the composer, `initialFocus` falls back to `"first"`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `fix(web): focus the assistant composer and restore focus on close`

---

### Task 6: The open conversation survives a reload (P19, U12)

**Files:**
- Create: `web/src/features/assistant/open-conversation.ts` (`readOpenConversation(): string | undefined`, `writeOpenConversation(id: string | undefined): void`, key `equori.assistant.conversation`, every access in `try/catch` as `features/accounts/pending-setup.ts` does)
- Modify: `web/src/features/assistant/use-assistant-turn.ts` (initial state from `readOpenConversation`; `turn` event, `open`, `reset` write it)
- Modify: `web/src/features/assistant/assistant-panel.tsx` (a 404 of the stored conversation calls `turn.reset()`)
- Test: `web/src/features/assistant/assistant-panel.test.tsx`

- [ ] **Step 1: Failing tests**

- `it("reopens the last conversation after a reload (U12)")`: `sessionStorage.setItem("equori.assistant.conversation", "c1")`; render; the stored answer of `c1` is shown without sending.
- `it("starts a new conversation after New conversation")`: click `New conversation`; `sessionStorage.getItem(...)` is null and the welcome title shows.
- `it("starts a new conversation when the stored one is gone")` (Review Focus 4): stored `c9`, route answers `problem(404, "conversation_not_found")`; the welcome title shows and the key is removed.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** as listed under Files.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): keep the open assistant conversation for the tab`

---

### Task 7: Phase verification

- [ ] **Step 1:** `make check` — PASS.
- [ ] **Step 2:** `make run-prod` with a scripted OpenAI-compatible stub as the user's provider (the study's stub at `127.0.0.1:8098`, never a real key), a Playwright `launch()` script closed in `finally`, at 1440 and 390 px: a 500 from the stub shows "Sem resposta do provedor" and "Tentar de novo", not "Limite de uso atingido"; after a reload the panel shows the same conversation; opening with `a` focuses the composer. Record the result in `.claude/progress/current.md`.
- [ ] **Step 3:** Report the phase, with a "Slotted findings" section (none expected).
