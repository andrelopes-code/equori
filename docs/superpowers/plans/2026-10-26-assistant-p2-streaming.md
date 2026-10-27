# Assistant phase 2: streaming and speed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The answer's text appears while the model writes it, the reader can stop a turn, every step of the turn is listed, and the read tools of one model response run concurrently.

**Architecture:** `llm` gains an optional `Streamer` provider interface and `Client.Stream`; `llm.Run` streams when `LoopOptions.OnText` is set and runs `ReadOnly` calls of one response concurrently. The turn handler forwards text as a new SSE event `delta`; the panel renders it, offers stop through the composer's `streaming` status, and lists the steps.

**Tech Stack:** Go 1.26 (`net/http`, `bufio`), React, Slotted `prompt-composer` and `message` families, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-mcp-agent-design.md` (sections 2.1, 2.5, 2.6, 4.2, 4.3). Depends on phase 1 (`docs/superpowers/plans/2026-10-26-assistant-p1-correctness.md`): outcome `canceled` and the cache write of the `answer` event.

## Global Constraints

- No system prompt change. E14 adds the `Thinking` field and its wire mapping only; the chat does not set it in this phase (gated on the owner's evaluation, design 2.6).
- Agents never run `-tags eval` or `-tags live` and never export a provider key. Adapter tests use `httptest` servers.
- The router falls back to the next target only before the first `onText`; after it, the call ends with that error (E3).
- Concurrency limit for `ReadOnly` calls of one response: 4 (E13).
- `delta` text is shown parsed as Markdown at most once per animation frame (P2).

## Review Focus

1. A Gemini stream that ends without a final chunk carrying `finishReason` (connection cut mid-answer): the call returns `ErrTransient`, never a truncated answer marked `stop`. Test in Task 2.
2. An OpenAI-compatible server that ignores `stream_options` and sends no usage chunk (older Ollama): the response has zero usage, no error. Test in Task 3.
3. A model response that mixes text and a tool call: the text reached the panel as `delta`, then `step` clears it; the stored answer never contains it. Test in Task 4.
4. Stop pressed after the answer event but before the stream closes: the answer stays `answered` (phase 1 `storeCtx` rule) and the panel shows it. Test in Task 6.
5. A read tool that fails while another concurrent read succeeds: both results reach the model in response order, the failing one as an error result. Test in Task 5.

---

### Task 1: `Streamer`, `Client.Stream` and streaming `Run` (E1, E3)

**Files:**
- Modify: `internal/platform/llm/provider.go`, `internal/platform/llm/router.go`, `internal/platform/llm/tools.go`
- Modify: `internal/platform/llm/llmtest/provider.go` (`Step.Chunks []string`; `Provider.Stream`)
- Test: `internal/platform/llm/router_test.go`, `internal/platform/llm/tools_test.go`

**Interfaces:**
- Produces:
  - `type Streamer interface { Stream(ctx context.Context, model string, req Request, onText func(string)) (Response, error) }` in `provider.go`.
  - `func (c *Client) Stream(ctx context.Context, req Request, onText func(string)) (Response, error)`; `Generate(ctx, req)` becomes `Stream(ctx, req, nil)`.
  - `LoopOptions.OnText func(string)`.
  - `llmtest.Step.Chunks`: when set, `Stream` calls `onText` with each chunk in order before returning `Response` or `Err`; `Generate` ignores `Chunks`.

- [ ] **Step 1: Failing tests**

`TestClientStream` (router_test):
- provider with `Stream`, step `Chunks: ["Sal", "do"]`, response text `"Saldo"` → `onText` received `["Sal","do"]`, response text `"Saldo"`.
- first target's step `Chunks: ["x"]`, `Err: ErrTransient`; a second target exists → the error returns, the second target is not called (E3).
- first target `Err: ErrTransient` with no chunks; second target answers → second target's response (fallback before the first text).
- provider without `Stream` (a wrapper type exposing only `Name` and `Generate`) → response returned, `onText` never called.
`TestRunStreams` (tools_test): `LoopOptions.OnText` receives the chunks of both steps of a `[call get_x, text]` run in order.

- [ ] **Step 2: Run** `go test ./internal/platform/llm -run 'TestClientStream|TestRunStreams' -count=1` — FAIL (undefined).

- [ ] **Step 3: Implement**

`Client.Stream` holds the current body of `Generate`; per target it calls `p.(Streamer).Stream` when `onText != nil` and the provider implements it, with a wrapper that marks `started`. When the call fails and `started` is true, it records the attempt with its outcome, sets no cooldown, and returns the error without trying the next target. `Run` calls `client.Stream(ctx, req, opts.OnText)`.

- [ ] **Step 4: Run** `go test ./internal/platform/llm/... -count=1` — PASS.

- [ ] **Step 5: Commit** `feat(platform): stream language model text through the router`

---

### Task 2: Gemini streaming and the thinking setting (E2, E14)

**Files:**
- Modify: `internal/platform/llm/aistudio/aistudio.go` (`Stream`), `internal/platform/llm/aistudio/wire.go` (`thinkingConfig`)
- Modify: `internal/platform/llm/request.go` (`Request.Thinking string`)
- Test: `internal/platform/llm/aistudio/aistudio_test.go`

**Interfaces:**
- Produces: `(*aistudio.Provider).Stream`; `llm.Request.Thinking` with values `""` and `"low"`.

- [ ] **Step 1: Failing tests**

`TestStream` with an `httptest` server that asserts the path `/v1beta/models/m:streamGenerateContent`, the query `alt=sse` and the header `x-goog-api-key`, then writes `data: {...}\n\n` frames:
- three text chunks `"A"`, `"B"`, `"C"`, the last with `finishReason: "STOP"` and `usageMetadata {promptTokenCount: 7, candidatesTokenCount: 3, thoughtsTokenCount: 2}` → `onText` got `["A","B","C"]`; response one text part `"ABC"`; usage `{7, 5}`; finish `stop`.
- a chunk with a `functionCall` part carrying `thoughtSignature` → one `ToolCall` part with that `Signature`; finish `tool_calls`.
- a text chunk whose last frame carries `thoughtSignature` on an empty text part → the signature sits on the joined text part.
- Review Focus 1: frames end without any `finishReason` → `errors.Is(err, llm.ErrTransient)`.
- a 429 status → the same `statusError` mapping as `Generate` (`*llm.QuotaError`).
`TestThinkingWire`: `Request{Thinking: "low"}` encodes `generationConfig.thinkingConfig.thinkingLevel` with the value the Gemini API reference lists for low thinking (read `https://ai.google.dev/api/generate-content#ThinkingConfig` before writing the constant); `Thinking: ""` encodes no `thinkingConfig`.

- [ ] **Step 2: Run** `go test ./internal/platform/llm/aistudio -count=1` — FAIL.

- [ ] **Step 3: Implement**

`Stream` posts the same body to `:streamGenerateContent?alt=sse`, reads lines with a `bufio.Scanner` whose buffer allows 1 MiB per line, decodes each `data:` line as `generateResponse`, calls `onText` for each non-thought text part, and merges chunks: a text part joins the preceding text part when that part has no signature; a signature on a joining chunk moves to the joined part; any other part is appended. The last `usageMetadata` and the last candidate `finishReason` are kept; the merged response goes through `fromWire`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(platform): stream Gemini answers`

---

### Task 3: OpenAI-compatible streaming (E2)

**Files:**
- Modify: `internal/platform/llm/openai/openai.go` (`Stream`), `internal/platform/llm/openai/wire.go` (`Stream bool`, `StreamOptions`, chunk types)
- Test: `internal/platform/llm/openai/openai_test.go`

- [ ] **Step 1: Failing tests**

`TestStream` over `httptest` asserting the body has `"stream":true` and `"stream_options":{"include_usage":true}`:
- `choices[0].delta.content` chunks `"A"`, `"B"`, a `finish_reason: "stop"` chunk, a usage chunk `{prompt_tokens: 4, completion_tokens: 2}` with empty `choices`, then `data: [DONE]` → `onText` `["A","B"]`, text `"AB"`, usage `{4, 2}`.
- `tool_calls` deltas at index 0 and 1, the name in the first delta of each and `arguments` split over three deltas → two `ToolCall` parts with IDs, names and the joined arguments; finish `tool_calls`.
- Review Focus 2: no usage chunk → usage `{0, 0}`, no error.
- the stream ends without `[DONE]` and without `finish_reason` → `errors.Is(err, llm.ErrTransient)`.

- [ ] **Step 2: Run** `go test ./internal/platform/llm/openai -count=1` — FAIL.

- [ ] **Step 3: Implement** `Stream` with the request flags above, the same status mapping as `do`, and accumulation of `tool_calls` by `index`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(platform): stream OpenAI-compatible answers`

---

### Task 4: The turn sends `delta` events (E4, E5)

**Files:**
- Modify: `internal/assistant/internal/app/turn.go` (`TurnEvents.Delta(text string)`; `Agent.Run` gains `onText func(string)`)
- Modify: `internal/assistant/internal/adapter/llmapi/turn.go` (`LoopOptions.OnText`)
- Modify: `internal/assistant/internal/adapter/httpapi/turn.go` (`Delta` writes `delta` `{text}`)
- Modify: `api/openapi.yaml` (description of `sendAssistantMessage`), `make gen`
- Modify: `docs/adr/020-assistant-conversation.md` (C3 amendment)
- Test: `internal/assistant/turn_test.go`

**Interfaces:**
- Produces: `app.Agent.Run(ctx, userID int64, req AgentRequest, onStep func(tool string), onText func(text string), onRestart func()) (AgentResult, error)`; SSE event `delta` with data `{"text": "<chunk>"}`.

- [ ] **Step 1: Failing test**

`TestTurnStreamsText`: provider steps `callStep("get_balances", "{}")` with `Chunks: ["Vou ver."]` and a text step `"Saldo: R$ 10,00"` with `Chunks: ["Saldo: ", "R$ 10,00"]` → events `turn, delta, step, delta, delta, answer`; delta data `{"text":"Vou ver."}`, `{"text":"Saldo: "}`, `{"text":"R$ 10,00"}`; the stored answer content is `"Saldo: R$ 10,00"` (Review Focus 3). `TestTurnRead` keeps its event list (`llmtest` steps without chunks send no `delta`).

- [ ] **Step 2: Run** `go test ./internal/assistant -run 'TestTurnStreamsText|TestTurnRead' -count=1` — FAIL.

- [ ] **Step 3: Implement** the interface change through `Service.Turn` (passes `ev.Delta`), the agent and the event stream. OpenAPI description line: "Events: turn {conversation_id, message_id}, delta {text}, step {tool}, answer (AssistantMessage) and error (Problem). Text received since the previous step belongs to a model call that asked for tools; a client drops it at the step."

- [ ] **Step 4: Run** `go test ./internal/assistant/... -count=1` — PASS.

- [ ] **Step 5: ADR 020 amendment** "C3 (design 2026-10-26 E4): the stream adds `delta {text}`; a `step` ends the text of a model call that asked for tools." Commit `feat(assistant): stream answer text as delta events`.

---

### Task 5: Concurrent read tools (E13)

**Files:**
- Modify: `internal/platform/llm/tools.go` (`LoopOptions.Concurrent func(name string) bool`)
- Modify: `internal/assistant/internal/adapter/llmapi/turn.go` (passes `Concurrent` from `tools.Effect`)
- Test: `internal/platform/llm/tools_test.go`

- [ ] **Step 1: Failing tests**

`TestRunConcurrentReads`:
- one response with three calls `r1, r2, r3` marked concurrent, each handler waits on a channel that closes when all three handlers have started (a `sync.WaitGroup`), with a test deadline of 5 s through `t.Context()` → the run completes; result parts in order `r1, r2, r3`.
- six concurrent calls whose handlers record the peak of a shared counter → peak `<= 4`, and `== 4` when each handler waits until four have started or none remain.
- calls `w1` (not concurrent), `r1`, `w2`, `r2` → handler start order puts `r1` and `r2` before `w1`, `w1` before `w2`; results in response order `w1, r1, w2, r2`; `OnToolCall` saw `w1, r1, w2, r2`.
- Review Focus 5: `r1` returns an error, `r2` succeeds → both results present in order, `r1` with `IsError`.

- [ ] **Step 2: Run** `go test ./internal/platform/llm -run TestRunConcurrentReads -count=1 -race` — FAIL.

- [ ] **Step 3: Implement**: `OnToolCall` runs for every call in response order before any handler; concurrent calls run under a semaphore of 4; the others run after them, one at a time, in response order; a context error from any call ends the run as today.

- [ ] **Step 4: Run** `go test ./internal/platform/llm/... ./internal/assistant/... -count=1 -race` — PASS.

- [ ] **Step 5: Commit** `perf(platform): run the read tools of one model response concurrently`

---

### Task 6: Streaming text and stop in the panel (P2, P3, P4; D1, D4, U6)

**Files:**
- Modify: `web/src/features/assistant/sse.ts` (`{ type: "delta"; text: string }`)
- Modify: `web/src/features/assistant/use-assistant-turn.ts` (`draft: string`, `stop(): void`)
- Modify: `web/src/features/assistant/assistant-composer.tsx` (props `onStop`; status `streaming` while busy)
- Modify: `web/src/features/assistant/assistant-panel.tsx` (pending answer renders `draft` through `MessageItem`'s Markdown path)
- Create: `web/src/features/assistant/use-frame-value.ts` (`useFrameValue<T>(value: T): T`, the latest value at most once per `requestAnimationFrame`)
- Modify: both catalogs (`assistant.composer.stop`: "Stop" / "Parar")
- Test: `web/src/features/assistant/sse.test.ts`, `web/src/features/assistant/assistant-panel.test.tsx`

**Interfaces:**
- Produces: `AssistantTurn.draft: string` (text since the last `step`), `AssistantTurn.stop: () => void`.

- [ ] **Step 1: Failing tests**

- `sse.test.ts`: `parseEvents('event: delta\ndata: {"text":"Sal"}\n\n', "")` → `[{type: "delta", text: "Sal"}]`.
- Panel `it("shows the answer while it streams (G2)")`: write `turn`, `delta` `"You spent "`, `delta` `"**10 items**"`; before any `answer` event, `findByText("10 items")` resolves inside a `strong`.
- `it("drops the text of a step")`: `delta` `"Let me check"`, then `step`; the text disappears and the step label shows.
- `it("stops a running turn (P3)")`: during an open stream, a button named `Stop` exists; clicking it aborts the fetch (the captured request's `signal.aborted` is true); after the conversation refetch returns a `canceled` message, `Stopped` shows under the user message.
- `it("keeps the text of the field on Enter during a turn (P4)")`: during an open stream, typing `next` and pressing Enter leaves `next` in the field and sends no second POST.
- Review Focus 4: `answer` written, then `Stop` clicked before `close()` → the answer stays visible.

- [ ] **Step 2: Run** `pnpm vitest run src/features/assistant` from `web/` — FAIL.

- [ ] **Step 3: Implement**: `draft` accumulates `delta` text and clears on `step` and on `answer`; `stop` aborts the controller; the composer's `status` is `"streaming"` while busy with `onStop={turn.stop}` and `messages={{ send, stop }}`; the pending answer renders `useFrameValue(turn.draft)` through `parseAnswer` and `Markdown`, masked by privacy as `MessageItem` masks a stored answer.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): stream the assistant answer and stop a turn`

---

### Task 7: Activity list of the turn (P5; D5, U16)

**Files:**
- Modify: `web/src/features/assistant/use-assistant-turn.ts` (`steps: string[]` of the running turn; `activity: Record<string, string[]>` keyed by answer message ID for answers of this session)
- Create: `web/src/features/assistant/turn-activity.tsx` (`TurnActivity({ steps, running }: { steps: string[]; running: boolean })`)
- Modify: `web/src/features/assistant/assistant-panel.tsx`, `web/src/features/assistant/message-item.tsx` (prop `steps?: string[]`)
- Modify: both catalogs (`assistant.activity.summary`: "Consulted {count} sources" / "Consultou {count} fontes"; plural forms per the catalog's existing plural pattern)
- Test: `web/src/features/assistant/assistant-panel.test.tsx`

- [ ] **Step 1: Failing tests**

- `it("lists every step of the turn (U16)")`: steps `search_transactions`, `get_balances` → both labels visible, the first with `MessageActivityStep status="complete"` (`data-status` attribute as the family renders it), the second `current`.
- `it("collapses the steps after the answer")`: after `answer`, one line `Consulted 2 sources`; activating it shows both labels.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** with `MessageActivity` and `MessageActivityStep` (read `node_modules/@slotted/react/dist/docs/families/message.md` first); the collapsed line uses the family's disclosure when it offers one, else a `Button variant="plain"` with `aria-expanded`. A family gap is a Slotted finding.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): list the steps of an assistant turn`

---

### Task 8: Phase verification

- [ ] **Step 1:** `make check` — PASS.
- [ ] **Step 2:** `make run-prod` with the study's stub extended to stream (`stream: true` → SSE chunks of 5 characters every 100 ms), Playwright `launch()` closed in `finally`, 1440 px: the first text appears before the `answer` event (record the elapsed time from send to first text and to answer); Stop leaves "Interrompida" under the question.
- [ ] **Step 3:** Hand off to the owner: E14 stays off until an evaluation run with `Thinking: "low"` passes every C13 threshold; the owner runs it. Report with a "Slotted findings" section.
