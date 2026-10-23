package assistant_test

import (
	"context"
	"encoding/json"
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
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
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

func newProposalEnv(t *testing.T) proposalEnv {
	t.Helper()
	note := newNoteFake()
	now := &atomic.Pointer[time.Time]{}
	start := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	now.Store(&start)
	h := apitest.New(t, apitest.ExtraTools(note.group()), apitest.Clock(func() time.Time { return *now.Load() }))
	return proposalEnv{h: h, note: note, now: now}
}

// propose stores a pending proposal of user's through the module and returns its ID.
func (e proposalEnv) propose(t *testing.T, userID int64, text string) string {
	t.Helper()
	conv := domain.Conversation{ID: uuid.New(), Title: "t", CreatedAt: *e.now.Load(), UpdatedAt: *e.now.Load()}
	if err := postgres.NewRepository(e.h.Pool).CreateConversation(t.Context(), userID, conv); err != nil {
		t.Fatal(err)
	}
	content, err := assistant.ProposeForTest(e.h.App.Assistant, t.Context(), userID, conv.ID, "note_for_test", json.RawMessage(`{"text":"`+text+`"}`))
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

// S136 (part): another user's proposal is not found.
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
