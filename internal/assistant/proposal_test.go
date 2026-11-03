package assistant_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/llmapi"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type noteIn struct {
	Text string `json:"text" jsonschema:"text to note"`
}

type noteOut struct {
	OK bool `json:"ok" jsonschema:"always true"`
}

// noteFake is the write tool note_for_test: its counter shows how often the handler ran and basis
// simulates data that changes after a proposal.
type noteFake struct {
	count atomic.Int64
	basis atomic.Value
	fail  atomic.Bool
}

func newNoteFake() *noteFake {
	f := &noteFake{}
	f.basis.Store("v1")

	return f
}

func (f *noteFake) group() tool.Group {
	return tool.Group{Tools: []tool.Tool{tool.NewWrite(
		tool.Spec{Name: "note_for_test", Description: "Notes a text.", Effect: tool.Write},
		func(_ context.Context, _ int64, in noteIn) (tool.Preview, error) {
			return tool.Preview{
				Action:  "note_for_test",
				Changes: []tool.Change{{Field: "description", After: tool.TextValue(in.Text)}},
				Basis:   f.basis.Load().(string),
			}, nil
		},
		func(_ context.Context, _ int64, _ noteIn) (noteOut, error) {
			if f.fail.Load() {
				return noteOut{}, tool.InvalidArgument("name", "exists")
			}

			f.count.Add(1)

			return noteOut{OK: true}, nil
		})}}
}

type proposalView struct {
	ID     string         `json:"id"`
	Tool   string         `json:"tool"`
	Status string         `json:"status"`
	Result map[string]any `json:"result"`
}

type proposalEnv struct {
	h    *apitest.Harness
	note *noteFake
	now  *atomic.Pointer[time.Time]
}

func newProposalEnv(t *testing.T, opts ...apitest.Option) proposalEnv {
	t.Helper()

	note := newNoteFake()
	now := &atomic.Pointer[time.Time]{}
	start := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	now.Store(&start)

	opts = append(opts, apitest.ExtraTools(note.group(), makeGroup()), apitest.Clock(func() time.Time { return *now.Load() }))
	h := apitest.New(t, opts...)

	return proposalEnv{h: h, note: note, now: now}
}

// propose stores a pending proposal of the book through the module and returns its ID.
func (e proposalEnv) propose(t *testing.T, booksID int64, text string) string {
	t.Helper()

	conv := domain.Conversation{ID: uuid.New(), Title: "t", CreatedAt: *e.now.Load(), UpdatedAt: *e.now.Load()}
	if err := postgres.NewRepository(e.h.Pool).CreateConversation(t.Context(), booksID, e.h.MemberIDOf("owner@example.com"), conv); err != nil {
		t.Fatal(err)
	}

	content, err := assistant.ProposeForTest(e.h.App.Assistant, t.Context(), booksID, conv.ID, "note_for_test", json.RawMessage(`{"text":"`+text+`"}`), app.ProposalMeta{})
	if err != nil {
		t.Fatal(err)
	}

	var out struct {
		ProposalID string `json:"proposal_id"`
		Status     string `json:"status"`
	}
	if err := json.Unmarshal(content, &out); err != nil {
		t.Fatal(err)
	}

	if out.Status != "awaiting_confirmation" {
		t.Fatalf("content = %s", content)
	}

	return out.ProposalID
}

func (e proposalEnv) status(t *testing.T, id string) string {
	t.Helper()

	var s string
	if err := e.h.Pool.QueryRow(t.Context(), `SELECT status FROM assistant_proposal WHERE id = $1`, id).Scan(&s); err != nil {
		t.Fatal(err)
	}

	return s
}

func (e proposalEnv) post(id, verb string) apitest.Response {
	return e.h.Do(http.MethodPost, "/api/v1/assistant/proposals/"+id+"/"+verb, nil)
}

// S132: a write tool stores a pending proposal and executes nothing.
func TestProposeStoresPending(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)

	id := e.propose(t, e.h.OwnerID(), "x")
	if got := e.status(t, id); got != "pending" {
		t.Fatalf("status = %s", got)
	}

	if n := e.note.count.Load(); n != 0 {
		t.Fatalf("handler ran %d times", n)
	}
}

// S133: confirming executes the tool once.
func TestConfirmExecutesOnce(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")

	r := e.post(id, "confirm")
	if r.Status != http.StatusOK {
		t.Fatalf("confirm = %d: %s", r.Status, r.Body)
	}

	var p proposalView
	r.Decode(t, &p)

	if p.Status != "executed" || p.ID != id || p.Tool != "note_for_test" || p.Result["ok"] != true {
		t.Fatalf("proposal = %+v", p)
	}

	e.h.ExpectProblem(e.post(id, "confirm"), http.StatusConflict, "proposal_closed", "")

	if n := e.note.count.Load(); n != 1 {
		t.Fatalf("handler ran %d times", n)
	}
}

func TestConfirmConcurrent(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")
	var wg sync.WaitGroup

	got := make([]apitest.Response, 2)
	for i := range got {
		wg.Go(func() { got[i] = e.post(id, "confirm") })
	}

	wg.Wait()

	ok, closed := 0, 0
	for _, r := range got {
		switch r.Status {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
			e.h.ExpectProblem(r, http.StatusConflict, "proposal_closed", "")

			closed++
		}
	}

	if ok != 1 || closed != 1 || e.note.count.Load() != 1 {
		t.Fatalf("ok = %d, closed = %d, runs = %d", ok, closed, e.note.count.Load())
	}
}

// S134: a proposal past its expiry is not executed.
func TestConfirmExpired(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")
	later := e.now.Load().Add(domain.ProposalTTL)
	e.now.Store(&later)
	e.h.ExpectProblem(e.post(id, "confirm"), http.StatusConflict, "proposal_expired", "")

	if n := e.note.count.Load(); n != 0 {
		t.Fatalf("handler ran %d times", n)
	}
}

// S135: data that changed after the proposal makes it stale.
func TestConfirmStale(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")
	e.note.basis.Store("v2")
	e.h.ExpectProblem(e.post(id, "confirm"), http.StatusConflict, "proposal_stale", "")

	if got := e.status(t, id); got != "stale" {
		t.Fatalf("status = %s", got)
	}

	if n := e.note.count.Load(); n != 0 {
		t.Fatalf("handler ran %d times", n)
	}
}

func TestRejectThenConfirm(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")
	r := e.post(id, "reject")
	var p proposalView

	if r.Status != http.StatusOK {
		t.Fatalf("reject = %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &p)

	if p.Status != "rejected" {
		t.Fatalf("proposal = %+v", p)
	}

	e.h.ExpectProblem(e.post(id, "confirm"), http.StatusConflict, "proposal_closed", "")
}

// S136 (part): another book's proposal is not found.
func TestProposalOtherUser(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")
	other := e.h.Login("other@example.com")
	r := e.h.Call(other, http.MethodPost, "/api/v1/assistant/proposals/"+id+"/confirm", nil)
	e.h.ExpectProblem(r, http.StatusNotFound, "proposal_not_found", "")

	if got := e.status(t, id); got != "pending" {
		t.Fatalf("status = %s", got)
	}
}

func TestConfirmToolFailure(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	id := e.propose(t, e.h.OwnerID(), "x")
	e.note.fail.Store(true)

	r := e.post(id, "confirm")
	if r.Status != http.StatusOK {
		t.Fatalf("confirm = %d: %s", r.Status, r.Body)
	}

	var p proposalView
	r.Decode(t, &p)

	if p.Status != "failed" || p.Result["code"] != "invalid_arguments" {
		t.Fatalf("proposal = %+v", p)
	}
}

func TestChatSetRefusesWriteWithoutPreview(t *testing.T) {
	t.Parallel()

	bare := tool.New(tool.Spec{Name: "bare_write", Description: "Writes.", Effect: tool.Write},
		func(context.Context, int64, noteIn) (noteOut, error) { return noteOut{}, nil })

	reg, err := tool.NewRegistry(slog.New(slog.DiscardHandler), tool.Group{Tools: []tool.Tool{bare}})
	if err != nil {
		t.Fatal(err)
	}

	set, err := reg.Select("bare_write")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := llmapi.NewChatSet(set); err == nil || !strings.Contains(err.Error(), "bare_write") {
		t.Fatalf("err = %v", err)
	}
}

type makeIn struct {
	IDRef          string `json:"id_ref" jsonschema:"id of the entity this one uses"`
	FailIfResolved bool   `json:"fail_if_resolved,omitzero" jsonschema:"fails the preview when id_ref is 42"`
}

type makeOut struct {
	ID string `json:"id" jsonschema:"id of the entity made"`
}

// makeGroup is the write tool make_for_test: it creates an entity with id "42" from the id_ref it uses.
func makeGroup() tool.Group {
	return tool.Group{Tools: []tool.Tool{tool.NewWrite(
		tool.Spec{Name: "make_for_test", Description: "Makes an entity.", Effect: tool.Write},
		func(_ context.Context, _ int64, in makeIn) (tool.Preview, error) {
			if in.FailIfResolved && in.IDRef == "42" {
				return tool.Preview{}, tool.InvalidArgument("id_ref", "is already in use")
			}

			return tool.Preview{
				Action:  "make_for_test",
				Changes: []tool.Change{{Field: "description", After: tool.TextValue(in.IDRef)}},
				Basis:   "v1",
			}, nil
		},
		func(_ context.Context, _ int64, _ makeIn) (makeOut, error) { return makeOut{ID: "42"}, nil })}}
}

type proposed struct {
	ID         string   `json:"proposal_id"`
	Status     string   `json:"status"`
	WaitingFor []string `json:"waiting_for"`
}

func (e proposalEnv) conversation(t *testing.T) uuid.UUID {
	t.Helper()

	conv := domain.Conversation{ID: uuid.New(), Title: "t", CreatedAt: *e.now.Load(), UpdatedAt: *e.now.Load()}
	if err := postgres.NewRepository(e.h.Pool).CreateConversation(t.Context(), e.h.OwnerID(), e.h.MemberIDOf("owner@example.com"), conv); err != nil {
		t.Fatal(err)
	}

	return conv.ID
}

// tryMake proposes make_for_test and returns the error of the call.
func (e proposalEnv) tryMake(t *testing.T, conv uuid.UUID, args string, meta app.ProposalMeta) (proposed, error) {
	t.Helper()

	content, err := assistant.ProposeForTest(e.h.App.Assistant, t.Context(), e.h.OwnerID(), conv, "make_for_test", json.RawMessage(args), meta)
	if err != nil {
		return proposed{}, err
	}

	var out proposed
	if err := json.Unmarshal(content, &out); err != nil {
		t.Fatal(err)
	}

	return out, nil
}

// make proposes make_for_test with id_ref "x" that refs replaces, and expects the call to succeed.
func (e proposalEnv) make(t *testing.T, conv uuid.UUID, refs map[string]string) proposed {
	t.Helper()

	meta := app.ProposalMeta{}
	if len(refs) > 0 {
		meta = app.ProposalMeta{Refs: refs, Summary: "uses the parent"}
	}

	out, err := e.tryMake(t, conv, `{"id_ref":"x"}`, meta)
	if tf, ok := errors.AsType[*app.ToolFailure](err); ok {
		t.Fatalf("tool failure: %s", tf.Content)
	}

	if err != nil {
		t.Fatal(err)
	}

	return out
}

func (e proposalEnv) column(t *testing.T, id, column string) map[string]any {
	t.Helper()

	var raw []byte
	if err := e.h.Pool.QueryRow(t.Context(), `SELECT `+column+`::text FROM assistant_proposal WHERE id = $1`, id).Scan(&raw); err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}

	return out
}

func ref(parent proposed) map[string]string { return map[string]string{"/id_ref": parent.ID} }

func (e proposalEnv) confirmOK(t *testing.T, id string) {
	t.Helper()

	if r := e.post(id, "confirm"); r.Status != http.StatusOK {
		t.Fatalf("confirm = %d: %s", r.Status, r.Body)
	}
}

func (e proposalEnv) expectStatus(t *testing.T, id, want string) {
	t.Helper()

	if got := e.status(t, id); got != want {
		t.Fatalf("status of %s = %s, want %s", id, got, want)
	}
}

func TestProposeRefsRefused(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		setup func(t *testing.T, e proposalEnv, conv uuid.UUID) (args string, meta app.ProposalMeta)
		field string
		code  string
	}{
		{
			name: "ref_other_conversation",
			setup: func(t *testing.T, e proposalEnv, _ uuid.UUID) (string, app.ProposalMeta) {
				parent := e.make(t, e.conversation(t), nil)
				return `{"id_ref":"x"}`, app.ProposalMeta{Refs: ref(parent), Summary: "s"}
			},
			field: "proposal.refs",
		},
		{
			name: "ref_rejected",
			setup: func(t *testing.T, e proposalEnv, conv uuid.UUID) (string, app.ProposalMeta) {
				parent := e.make(t, conv, nil)
				if r := e.post(parent.ID, "reject"); r.Status != http.StatusOK {
					t.Fatalf("reject = %d", r.Status)
				}

				return `{"id_ref":"x"}`, app.ProposalMeta{Refs: ref(parent), Summary: "s"}
			},
			field: "proposal.refs",
		},
		{
			name: "ref_missing",
			setup: func(*testing.T, proposalEnv, uuid.UUID) (string, app.ProposalMeta) {
				return `{"id_ref":"x"}`, app.ProposalMeta{Refs: map[string]string{"/id_ref": uuid.NewString()}, Summary: "s"}
			},
			field: "proposal.refs",
		},
		{
			name: "ref_not_a_field",
			setup: func(t *testing.T, e proposalEnv, conv uuid.UUID) (string, app.ProposalMeta) {
				return `{"id_ref":"x"}`, app.ProposalMeta{Refs: map[string]string{"/other": e.make(t, conv, nil).ID}, Summary: "s"}
			},
			field: "proposal.refs",
		},
		{
			name: "ref_malformed",
			setup: func(*testing.T, proposalEnv, uuid.UUID) (string, app.ProposalMeta) {
				return `{"id_ref":"x"}`, app.ProposalMeta{Refs: map[string]string{"/id_ref": "not-an-id"}, Summary: "s"}
			},
			field: "proposal.refs",
		},
		{
			name: "suggested_without_reason",
			setup: func(*testing.T, proposalEnv, uuid.UUID) (string, app.ProposalMeta) {
				return `{"id_ref":"x"}`, app.ProposalMeta{Suggested: true, Reason: " "}
			},
			field: "proposal.reason",
		},
		{
			name: "refs_without_summary",
			setup: func(t *testing.T, e proposalEnv, conv uuid.UUID) (string, app.ProposalMeta) {
				return `{"id_ref":"x"}`, app.ProposalMeta{Refs: ref(e.make(t, conv, nil))}
			},
			field: "proposal.summary",
		},
		{
			name: "waiting_with_invalid_arguments",
			setup: func(t *testing.T, e proposalEnv, conv uuid.UUID) (string, app.ProposalMeta) {
				return `{"id_ref":1}`, app.ProposalMeta{Refs: ref(e.make(t, conv, nil)), Summary: "s"}
			},
			code: "invalid_arguments",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			e := newProposalEnv(t)
			conv := e.conversation(t)
			args, meta := tt.setup(t, e, conv)

			_, err := e.tryMake(t, conv, args, meta)

			tf, ok := errors.AsType[*app.ToolFailure](err)
			if !ok {
				t.Fatalf("err = %v", err)
			}

			var got struct {
				Code   string `json:"code"`
				Errors []struct {
					Field string `json:"field"`
				} `json:"errors"`
			}
			if err := json.Unmarshal(tf.Content, &got); err != nil {
				t.Fatal(err)
			}

			if got.Code != "invalid_arguments" || tt.field != "" && (len(got.Errors) == 0 || got.Errors[0].Field != tt.field) {
				t.Fatalf("content = %s, want field %q", tf.Content, tt.field)
			}
		})
	}
}

// confirm_waiting_409 and the promotion of a dependent when its parent executes.
func TestWaitingProposalPromotes(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)
	child := e.make(t, conv, ref(parent))

	if child.Status != "waiting_for_confirmation_of" || len(child.WaitingFor) != 1 || child.WaitingFor[0] != parent.ID {
		t.Fatalf("child = %+v", child)
	}

	e.expectStatus(t, child.ID, "waiting")
	e.h.ExpectProblem(e.post(child.ID, "confirm"), http.StatusConflict, "proposal_waiting", "")
	e.confirmOK(t, parent.ID)
	e.expectStatus(t, child.ID, "pending")

	if got := e.column(t, child.ID, "arguments")["id_ref"]; got != "42" {
		t.Fatalf("id_ref = %v", got)
	}

	if got := fmt.Sprint(e.column(t, child.ID, "preview")["changes"]); !strings.Contains(got, "42") {
		t.Fatalf("preview changes = %s", got)
	}

	e.confirmOK(t, child.ID)
	e.expectStatus(t, child.ID, "executed")
}

func TestDependentOfExecutedParentIsPending(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)
	e.confirmOK(t, parent.ID)

	child := e.make(t, conv, ref(parent))
	if child.Status != "awaiting_confirmation" {
		t.Fatalf("child = %+v", child)
	}

	e.expectStatus(t, child.ID, "pending")

	if got := e.column(t, child.ID, "arguments")["id_ref"]; got != "42" {
		t.Fatalf("id_ref = %v", got)
	}
}

func TestParentRejectedBlocks(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)
	child := e.make(t, conv, ref(parent))
	grandchild := e.make(t, conv, ref(child))

	if len(grandchild.WaitingFor) != 1 || grandchild.WaitingFor[0] != child.ID {
		t.Fatalf("grandchild = %+v", grandchild)
	}

	if r := e.post(parent.ID, "reject"); r.Status != http.StatusOK {
		t.Fatalf("reject = %d: %s", r.Status, r.Body)
	}

	e.expectStatus(t, child.ID, "blocked")
	e.expectStatus(t, grandchild.ID, "blocked")
}

func TestDependentPreviewFails(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)
	meta := app.ProposalMeta{Refs: ref(parent), Summary: "s"}

	child, err := e.tryMake(t, conv, `{"id_ref":"x","fail_if_resolved":true}`, meta)
	if err != nil {
		t.Fatal(err)
	}

	grandchild := e.make(t, conv, ref(child))
	e.confirmOK(t, parent.ID)
	e.expectStatus(t, child.ID, "failed")
	e.expectStatus(t, grandchild.ID, "blocked")

	if got := e.column(t, child.ID, "result")["code"]; got != "invalid_arguments" {
		t.Fatalf("result code = %v", got)
	}
}

func TestReferenceUnresolved(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)

	child, err := e.tryMake(t, conv, `{"id_ref":"x"}`, app.ProposalMeta{
		Refs: map[string]string{"/id_ref": parent.ID + "#/nope"}, Summary: "s",
	})
	if err != nil {
		t.Fatal(err)
	}

	e.confirmOK(t, parent.ID)
	e.expectStatus(t, child.ID, "failed")

	got := e.column(t, child.ID, "result")
	if got["error"] != "reference_unresolved" || got["field"] != "/id_ref" {
		t.Fatalf("result = %v", got)
	}
}

func TestReferenceUnresolvedAtProposal(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)
	e.confirmOK(t, parent.ID)

	_, err := e.tryMake(t, conv, `{"id_ref":"x"}`, app.ProposalMeta{
		Refs: map[string]string{"/id_ref": parent.ID + "#/nope"}, Summary: "s",
	})
	if _, ok := errors.AsType[*app.ToolFailure](err); !ok {
		t.Fatalf("err = %v", err)
	}
}

// restart_discards_waiting: a restart of the turn discards the waiting proposals it created.
func TestRestartDiscardsWaiting(t *testing.T) {
	t.Parallel()

	steps := []llmtest.Step{
		{}, // set once the parent exists
		{Model: chatModel, Err: &llm.QuotaError{RetryAfter: time.Hour}},
		{Model: "gemini-3.1-flash-lite", Response: textStep("ok").Response},
	}
	p := llmtest.New("aistudio", steps...)
	e := newProposalEnv(t, apitest.LLM(p))
	conv := e.conversation(t)
	parent := e.make(t, conv, nil)

	args := fmt.Sprintf(`{"id_ref":"x","proposal":{"refs":{"/id_ref":%q},"summary":"s"}}`, parent.ID)
	steps[0] = callStep("make_for_test", args) // llmtest.New keeps the slice

	r := sendTurn(e.h, e.h.Client, map[string]any{"text": "go", "conversation_id": conv.String()})
	if r.Status != http.StatusOK {
		t.Fatalf("turn = %d: %s", r.Status, r.Body)
	}

	var got []string

	rows, err := e.h.Pool.Query(t.Context(), `SELECT status FROM assistant_proposal WHERE conversation_id = $1 ORDER BY created_at`, conv)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}

		got = append(got, s)
	}

	if fmt.Sprint(got) != "[pending discarded]" {
		t.Fatalf("statuses = %v", got)
	}
}

// Spec 2026-11-03 §4.1: every write declaration of the chat has the property proposal, no read one has.
func TestChatDeclarationsCarryProposal(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)

	decls, _ := assistant.ChatHandlersForTest(e.h.App.Assistant, func(context.Context) uuid.UUID { return uuid.Nil })
	effects := map[string]tool.Effect{}
	for _, tl := range e.h.App.Tools.Tools() {
		effects[tl.Spec().Name] = tl.Spec().Effect
	}

	writes, reads := 0, 0

	for _, d := range decls {
		var schema struct {
			Properties map[string]struct {
				Type       string                     `json:"type"`
				Properties map[string]json.RawMessage `json:"properties"`
			} `json:"properties"`
		}
		if err := json.Unmarshal(d.Parameters, &schema); err != nil {
			t.Fatalf("%s: %v", d.Name, err)
		}

		p, has := schema.Properties["proposal"]
		if effects[d.Name] == tool.ReadOnly {
			reads++

			if has {
				t.Errorf("%s: a read declaration has the property proposal", d.Name)
			}

			continue
		}

		writes++

		if !has || p.Type != "object" || len(p.Properties) != 4 {
			t.Errorf("%s: proposal = %+v, want an object with 4 properties", d.Name, p)
		}
	}

	if writes < 2 || reads < 1 {
		t.Fatalf("writes = %d, reads = %d", writes, reads)
	}
}

func TestChatHandlerStoresSuggestion(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	conv := e.conversation(t)

	_, handlers := assistant.ChatHandlersForTest(e.h.App.Assistant, func(context.Context) uuid.UUID { return conv })
	ctx := auth.WithIdentity(t.Context(), e.h.MemberIDOf("owner@example.com"), e.h.OwnerID(), auth.RoleOwner)

	t.Run("object", func(t *testing.T) {
		out, err := handlers["note_for_test"](ctx, json.RawMessage(`{"text":"x","proposal":{"suggested":true,"reason":"seen twice"}}`))
		if err != nil {
			t.Fatal(err)
		}

		var got struct {
			ProposalID string `json:"proposal_id"`
		}
		if err := json.Unmarshal(out, &got); err != nil {
			t.Fatal(err)
		}

		var suggested bool
		var reason string
		if err := e.h.Pool.QueryRow(t.Context(), `SELECT suggested, reason FROM assistant_proposal WHERE id = $1`, got.ProposalID).Scan(&suggested, &reason); err != nil {
			t.Fatal(err)
		}

		if !suggested || reason != "seen twice" {
			t.Fatalf("suggested = %v, reason = %q", suggested, reason)
		}
	})
	t.Run("string", func(t *testing.T) {
		_, err := handlers["note_for_test"](ctx, json.RawMessage(`{"text":"x","proposal":"yes"}`))

		var te *llm.ToolError
		if !errors.As(err, &te) || !strings.Contains(string(te.Content), `"proposal"`) {
			t.Fatalf("err = %v", err)
		}
	})
}
