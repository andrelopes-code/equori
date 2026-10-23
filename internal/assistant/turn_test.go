package assistant_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const chatModel = "gemini-3.5-flash-lite"

func textStep(s string) llmtest.Step {
	return llmtest.Step{Model: chatModel, Response: llm.Response{
		Message: llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: s}}}, FinishReason: llm.FinishStop,
	}}
}

func callStep(name, args string) llmtest.Step {
	return llmtest.Step{Model: chatModel, Response: llm.Response{
		Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{ToolCall: &llm.ToolCall{Name: name, Args: json.RawMessage(args)}}}},
		FinishReason: llm.FinishToolCalls,
	}}
}

type sseEvent struct {
	Name string
	Data string
}

func parseSSE(body []byte) []sseEvent {
	var out []sseEvent
	for _, block := range strings.Split(strings.TrimSpace(string(body)), "\n\n") {
		var e sseEvent
		for _, line := range strings.Split(block, "\n") {
			if v, ok := strings.CutPrefix(line, "event: "); ok {
				e.Name = v
			}
			if v, ok := strings.CutPrefix(line, "data: "); ok {
				e.Data = v
			}
		}
		out = append(out, e)
	}
	return out
}

type turnAnswer struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	Outcome   string `json:"outcome"`
	Proposals []struct {
		Tool   string `json:"tool"`
		Status string `json:"status"`
	} `json:"proposals"`
}

func sendTurn(h *apitest.Harness, c *http.Client, body map[string]any) apitest.Response {
	return h.Call(c, http.MethodPost, "/api/v1/assistant/turns", body)
}

func eventNames(events []sseEvent) []string {
	names := make([]string, len(events))
	for i, e := range events {
		names[i] = e.Name
	}
	return names
}

func turnHarness(t *testing.T, p *llmtest.Provider, opts ...apitest.Option) *apitest.Harness {
	t.Helper()
	return apitest.New(t, append([]apitest.Option{apitest.LLM(p), apitest.Today("2026-10-23")}, opts...)...)
}

func conversationMessages(t *testing.T, h *apitest.Harness, id string) []turnAnswer {
	t.Helper()
	var d struct {
		Messages []turnAnswer `json:"messages"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/conversations/"+id, nil, http.StatusOK, &d)
	return d.Messages
}

func lastTurnLog(h *apitest.Harness) string {
	var last string
	for _, line := range strings.Split(h.Logs(), "\n") {
		if strings.Contains(line, `msg="assistant turn"`) {
			last = line
		}
	}
	return last
}

// S131: a read question streams turn, step and answer and stores both messages.
func TestTurnRead(t *testing.T) {
	t.Parallel()
	p := llmtest.New("aistudio", callStep("get_balances", `{}`), textStep("Saldo: R$ 10,00"))
	h := turnHarness(t, p)
	r := sendTurn(h, h.Client, map[string]any{"text": "Qual o saldo?", "page": "/cards"})
	if r.Status != http.StatusOK || !strings.HasPrefix(r.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("status = %d, type = %q: %s", r.Status, r.Header.Get("Content-Type"), r.Body)
	}
	events := parseSSE(r.Body)
	if got := eventNames(events); !slices.Equal(got, []string{"turn", "step", "answer"}) {
		t.Fatalf("events = %v: %s", got, r.Body)
	}
	if events[1].Data != `{"tool":"get_balances"}` {
		t.Fatalf("step data = %s", events[1].Data)
	}
	var turn struct {
		ConversationID string `json:"conversation_id"`
	}
	if err := json.Unmarshal([]byte(events[0].Data), &turn); err != nil {
		t.Fatal(err)
	}
	var answer turnAnswer
	if err := json.Unmarshal([]byte(events[2].Data), &answer); err != nil {
		t.Fatal(err)
	}
	if answer.Content != "Saldo: R$ 10,00" || answer.Outcome != "answered" || answer.Role != "assistant" {
		t.Fatalf("answer = %+v", answer)
	}
	if msgs := conversationMessages(t, h, turn.ConversationID); len(msgs) != 2 || msgs[0].Role != "user" || msgs[0].Content != "Qual o saldo?" || msgs[1].ID != answer.ID {
		t.Fatalf("messages = %+v", msgs)
	}
	req := p.Requests()[0].Request
	today := time.Date(2026, 10, 23, 0, 0, 0, 0, time.UTC)
	if want := app.Prompt(app.PromptInput{Today: today, Locale: locale.Locale{Language: "pt", Region: "BR"}, Page: "/cards"}); req.System != want {
		t.Fatalf("system = %q, want %q", req.System, want)
	}
	var want, got []string
	for _, tl := range h.App.Tools.Tools() {
		want = append(want, tl.Spec().Name)
	}
	for _, tl := range req.Tools {
		got = append(got, tl.Name)
	}
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("tools = %v, want %v", got, want)
	}
	// S139 shares this flow's log line check: steps and tool calls are counted, content is not logged.
	line := lastTurnLog(h)
	if !strings.Contains(line, "steps=2") || !strings.Contains(line, "tool_calls=1") || !strings.Contains(line, "outcome=answered") {
		t.Fatalf("turn log = %q", line)
	}
	if strings.Contains(h.Logs(), "Qual o saldo?") || strings.Contains(h.Logs(), "R$ 10,00") {
		t.Fatal("logs carry message text")
	}
}

// S132 through the turn: a write tool stores a pending proposal that the answer carries.
func TestTurnProposal(t *testing.T) {
	t.Parallel()
	p := llmtest.New("aistudio", callStep("note_for_test", `{"text":"x"}`), textStep("Confirme no cartão."))
	h := turnHarness(t, p, apitest.ExtraTools(newNoteFake().group()))
	r := sendTurn(h, h.Client, map[string]any{"text": "anota x"})
	events := parseSSE(r.Body)
	if r.Status != http.StatusOK || events[len(events)-1].Name != "answer" {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}
	var answer turnAnswer
	if err := json.Unmarshal([]byte(events[len(events)-1].Data), &answer); err != nil {
		t.Fatal(err)
	}
	if len(answer.Proposals) != 1 || answer.Proposals[0].Status != "pending" || answer.Proposals[0].Tool != "note_for_test" {
		t.Fatalf("proposals = %+v", answer.Proposals)
	}
}

// S137: every target cooling answers 429 before the stream and sends no request.
func TestTurnExhausted(t *testing.T) {
	t.Parallel()
	quota := func(model string) llmtest.Step {
		return llmtest.Step{Model: model, Err: &llm.QuotaError{RetryAfter: time.Hour}}
	}
	p := llmtest.New("aistudio", quota("gemini-3.5-flash-lite"), quota("gemini-3.5-flash"))
	h := turnHarness(t, p)
	ctx := auth.WithUserID(t.Context(), h.OwnerID())
	_, _ = h.App.LLM.Use(assistant.ChatUse).Generate(ctx, llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}})
	before := len(p.Requests())
	r := sendTurn(h, h.Client, map[string]any{"text": "oi"})
	h.ExpectProblem(r, http.StatusTooManyRequests, "assistant_exhausted", "")
	var d struct {
		RetryAt *time.Time `json:"retry_at"`
	}
	r.Decode(t, &d)
	if d.RetryAt == nil {
		t.Fatalf("no retry_at: %s", r.Body)
	}
	if n := len(p.Requests()) - before; n != 0 {
		t.Fatalf("provider received %d requests", n)
	}
	var list struct {
		Items []json.RawMessage `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/conversations", nil, http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Fatalf("conversations = %d", len(list.Items))
	}
}

func TestTurnUnavailable(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.ExpectProblem(sendTurn(h, h.Client, map[string]any{"text": "oi"}), http.StatusServiceUnavailable, "assistant_unavailable", "")
}

// S139: the first target answers a tool call, then fails for quota; the turn restarts on the second.
func TestTurnFallback(t *testing.T) {
	t.Parallel()
	p := llmtest.New("aistudio",
		callStep("get_balances", `{}`),
		llmtest.Step{Model: chatModel, Err: &llm.QuotaError{RetryAfter: time.Hour}},
		llmtest.Step{Model: "gemini-3.5-flash", Response: callStep("get_balances", `{}`).Response},
		llmtest.Step{Model: "gemini-3.5-flash", Response: textStep("ok").Response},
	)
	h := turnHarness(t, p)
	r := sendTurn(h, h.Client, map[string]any{"text": "saldo"})
	events := parseSSE(r.Body)
	last := events[len(events)-1]
	var answer turnAnswer
	if last.Name != "answer" || json.Unmarshal([]byte(last.Data), &answer) != nil || answer.Content != "ok" {
		t.Fatalf("events = %s", r.Body)
	}
	if line := lastTurnLog(h); !strings.Contains(line, "restarted=true") {
		t.Fatalf("turn log = %q", line)
	}
}

// S140: the last allowed step forbids tool calls and its answer has outcome step_limit.
func TestTurnStepLimit(t *testing.T) {
	t.Parallel()
	steps := make([]llmtest.Step, app.MaxSteps)
	for i := range steps {
		steps[i] = callStep("get_balances", `{}`)
	}
	p := llmtest.New("aistudio", steps...)
	h := turnHarness(t, p)
	r := sendTurn(h, h.Client, map[string]any{"text": "saldo"})
	events := parseSSE(r.Body)
	var answer turnAnswer
	if last := events[len(events)-1]; last.Name != "answer" || json.Unmarshal([]byte(last.Data), &answer) != nil || answer.Outcome != "step_limit" {
		t.Fatalf("events = %s", r.Body)
	}
	reqs := p.Requests()
	if len(reqs) != app.MaxSteps || reqs[app.MaxSteps-1].Request.ToolChoice != llm.ToolChoiceNone || reqs[0].Request.ToolChoice != llm.ToolChoiceAuto {
		t.Fatalf("requests = %d, last tool choice = %q", len(reqs), reqs[len(reqs)-1].Request.ToolChoice)
	}
}

func TestTurnFailed(t *testing.T) {
	t.Parallel()
	p := llmtest.New("aistudio", llmtest.Step{Model: chatModel, Err: llm.ErrInvalidRequest})
	h := turnHarness(t, p)
	r := sendTurn(h, h.Client, map[string]any{"text": "oi"})
	events := parseSSE(r.Body)
	if r.Status != http.StatusOK || !slices.Equal(eventNames(events), []string{"turn", "error"}) {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}
	var problem struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal([]byte(events[1].Data), &problem); err != nil || problem.Code != "assistant_failed" {
		t.Fatalf("error event = %s", events[1].Data)
	}
	var turn struct {
		ConversationID string `json:"conversation_id"`
	}
	if err := json.Unmarshal([]byte(events[0].Data), &turn); err != nil {
		t.Fatal(err)
	}
	if msgs := conversationMessages(t, h, turn.ConversationID); len(msgs) != 1 || msgs[0].Role != "user" {
		t.Fatalf("messages = %+v", msgs)
	}
}

type blockingProvider struct {
	entered chan struct{}
	calls   atomic.Int64
}

func (*blockingProvider) Name() string { return "aistudio" }

func (b *blockingProvider) Generate(ctx context.Context, _ string, _ llm.Request) (llm.Response, error) {
	b.calls.Add(1)
	close(b.entered)
	<-ctx.Done()
	return llm.Response{}, ctx.Err()
}

// Review focus 2: a disconnect stops the turn; the user message stays and no answer is stored.
func TestTurnClientDisconnect(t *testing.T) {
	t.Parallel()
	bp := &blockingProvider{entered: make(chan struct{})}
	h := turnHarness(t, nil, apitest.LLM(bp))
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	body, _ := json.Marshal(map[string]any{"text": "oi"})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.URL()+"/api/v1/assistant/turns", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := h.Client.Do(req) //nolint:gosec // the harness's own server
	if err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 4096)
	n, err := resp.Body.Read(buf)
	if err != nil || !strings.Contains(string(buf[:n]), "event: turn") {
		t.Fatalf("first read = %q, %v", buf[:n], err)
	}
	<-bp.entered
	cancel()
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	h.Close()
	if line := lastTurnLog(h); !strings.Contains(line, "outcome=canceled") {
		t.Fatalf("turn log = %q, want outcome=canceled", line)
	}
	var count int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM assistant_message WHERE role = 'assistant'`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("assistant messages = %d, %v", count, err)
	}
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM assistant_message WHERE role = 'user'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("user messages = %d, %v", count, err)
	}
}

// S136: another user's conversation is not found.
func TestTurnOtherUserConversation(t *testing.T) {
	t.Parallel()
	p := llmtest.New("aistudio", textStep("ok"), textStep("ok"))
	h := turnHarness(t, p)
	r := sendTurn(h, h.Client, map[string]any{"text": "oi"})
	var turn struct {
		ConversationID string `json:"conversation_id"`
	}
	if err := json.Unmarshal([]byte(parseSSE(r.Body)[0].Data), &turn); err != nil {
		t.Fatal(err)
	}
	other := h.Login("other@example.com")
	h.ExpectProblem(sendTurn(h, other, map[string]any{"conversation_id": turn.ConversationID, "text": "oi"}), http.StatusNotFound, "conversation_not_found", "")
	h.ExpectProblem(h.Call(other, http.MethodGet, "/api/v1/assistant/conversations/"+turn.ConversationID, nil), http.StatusNotFound, "conversation_not_found", "")
}
