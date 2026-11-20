package assistant_test

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// V19: undoing an executed proposal runs its inverse once, as a proposal of the same answer.
func TestUndoReversesAnExecutedProposal(t *testing.T) {
	t.Parallel()

	keep := &keepFake{}
	e := newProposalEnv(t, apitest.ExtraTools(keep.group()))
	id := e.proposeKeep(t, `{"name":"a"}`)

	r := e.post(id, "confirm")
	if r.Status != http.StatusOK {
		t.Fatalf("confirm = %d: %s", r.Status, r.Body)
	}

	var confirmed undoView
	r.Decode(t, &confirmed)

	if !confirmed.Undoable {
		t.Fatalf("an executed keep is not undoable: %s", r.Body)
	}

	r = e.undo(id, "Desfeito no assistente")
	if r.Status != http.StatusOK {
		t.Fatalf("undo = %d: %s", r.Status, r.Body)
	}

	var u undoView
	r.Decode(t, &u)

	if u.Status != "executed" || u.Tool != "drop_for_test" || u.Undoes != id || u.Undoable {
		t.Fatalf("undo = %s", r.Body)
	}

	if got := keep.dropped(); len(got) != 1 ||
		got[0] != (dropIn{ID: "k1", Reason: "Desfeito no assistente"}) {
		t.Fatalf("dropped = %+v", got)
	}

	e.h.ExpectProblem(e.undo(id, "again"), http.StatusConflict, "proposal_undone", "")
	e.h.ExpectProblem(e.undo(u.ID, "back"), http.StatusConflict, "proposal_not_undoable", "")
}

// V19: a write without an exact inverse, or a proposal not executed, is not undone.
func TestUndoRefusesWithoutInverse(t *testing.T) {
	t.Parallel()

	keep := &keepFake{}
	e := newProposalEnv(t, apitest.ExtraTools(keep.group()))

	note := e.propose(t, e.h.OwnerID(), "x")
	e.confirmOK(t, note)
	e.h.ExpectProblem(e.undo(note, "r"), http.StatusConflict, "proposal_not_undoable", "")

	kept := e.proposeKeep(t, `{"name":"forever","keep":true}`)
	e.confirmOK(t, kept)
	e.h.ExpectProblem(e.undo(kept, "r"), http.StatusConflict, "proposal_not_undoable", "")

	pending := e.proposeKeep(t, `{"name":"a"}`)
	e.h.ExpectProblem(e.undo(pending, "r"), http.StatusConflict, "proposal_not_undoable", "")

	e.h.ExpectProblem(e.undo(note, ""), http.StatusBadRequest, "invalid_request", "")
}

// V19: an inverse that fails leaves the proposal undoable, and the failure is the answer.
func TestUndoFailureKeepsTheProposalUndoable(t *testing.T) {
	t.Parallel()

	keep := &keepFake{}
	e := newProposalEnv(t, apitest.ExtraTools(keep.group()))
	id := e.proposeKeep(t, `{"name":"a"}`)
	e.confirmOK(t, id)

	keep.refuse(true)

	r := e.undo(id, "r")
	if r.Status != http.StatusOK {
		t.Fatalf("undo = %d: %s", r.Status, r.Body)
	}

	var u undoView
	r.Decode(t, &u)

	if u.Status != "failed" || u.Undoes != id {
		t.Fatalf("undo = %s", r.Body)
	}

	keep.refuse(false)

	if r := e.undo(id, "r"); r.Status != http.StatusOK {
		t.Fatalf("second undo = %d: %s", r.Status, r.Body)
	}

	if got := keep.dropped(); len(got) != 1 {
		t.Fatalf("dropped = %+v", got)
	}
}

// V19: two undo requests at once run the inverse once.
func TestUndoConcurrent(t *testing.T) {
	t.Parallel()

	keep := &keepFake{}
	e := newProposalEnv(t, apitest.ExtraTools(keep.group()))
	id := e.proposeKeep(t, `{"name":"a"}`)
	e.confirmOK(t, id)

	var wg sync.WaitGroup

	codes := make([]int, 4)
	for i := range codes {
		wg.Go(func() { codes[i] = e.undo(id, "r").Status })
	}

	wg.Wait()

	ok := 0
	for _, c := range codes {
		if c == http.StatusOK {
			ok++
		} else if c != http.StatusConflict {
			t.Fatalf("codes = %v", codes)
		}
	}

	if ok != 1 || len(keep.dropped()) != 1 {
		t.Fatalf("codes = %v, dropped = %+v", codes, keep.dropped())
	}
}

// HA28: a member does not undo the proposal of another member's conversation.
func TestUndoOtherMember(t *testing.T) {
	t.Parallel()

	keep := &keepFake{}
	e := newProposalEnv(t, apitest.ExtraTools(keep.group()))
	id := e.proposeKeep(t, `{"name":"a"}`)
	e.confirmOK(t, id)

	other := e.h.Login("other@example.com")
	r := e.h.Call(
		other,
		http.MethodPost,
		"/api/v1/assistant/proposals/"+id+"/undo",
		map[string]string{"reason": "r"},
	)
	e.h.ExpectProblem(r, http.StatusNotFound, "proposal_not_found", "")
}

type undoView struct {
	ID       string `json:"id"`
	Tool     string `json:"tool"`
	Status   string `json:"status"`
	Undoable bool   `json:"undoable"`
	Undoes   string `json:"undoes"`
}

type keepIn struct {
	Name string `json:"name"          jsonschema:"name of the entity"`
	Keep bool   `json:"keep,omitzero" jsonschema:"true makes a call without inverse"`
}

type keepOut struct {
	ID string `json:"id" jsonschema:"id of the entity kept"`
}

type dropIn struct {
	ID     string `json:"id"     jsonschema:"id of the entity"`
	Reason string `json:"reason" jsonschema:"why it is dropped"`
}

// keepFake is keep_for_test, whose inverse is drop_for_test, and records each drop.
type keepFake struct {
	mu      sync.Mutex
	drops   []dropIn
	refused bool
}

func (f *keepFake) group() tool.Group {
	keep := tool.WithUndo(
		tool.NewWrite(
			tool.Spec{Name: "keep_for_test", Description: "Keeps an entity.", Effect: tool.Write},
			func(_ context.Context, _ int64, in keepIn) (tool.Preview, error) {
				return tool.Preview{
					Action:  "keep_for_test",
					Changes: []tool.Change{},
					Basis:   in.Name,
				}, nil
			},
			func(context.Context, int64, keepIn) (keepOut, error) { return keepOut{ID: "k1"}, nil },
		),
		func(in keepIn, out keepOut, reason string) (string, any, bool) {
			return "drop_for_test", dropIn{ID: out.ID, Reason: reason}, !in.Keep
		},
	)
	drop := tool.NewWrite(
		tool.Spec{Name: "drop_for_test", Description: "Drops an entity.", Effect: tool.Destructive},
		func(_ context.Context, _ int64, in dropIn) (tool.Preview, error) {
			return tool.Preview{
				Action:  "drop_for_test",
				Target:  in.ID,
				Changes: []tool.Change{},
			}, nil
		},
		func(_ context.Context, _ int64, in dropIn) (keepOut, error) {
			f.mu.Lock()
			defer f.mu.Unlock()

			if f.refused {
				return keepOut{}, tool.InvalidArgument("id", "is in use")
			}

			f.drops = append(f.drops, in)

			return keepOut{ID: in.ID}, nil
		},
	)

	return tool.Group{Tools: []tool.Tool{keep, drop}}
}

func (f *keepFake) refuse(on bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.refused = on
}

func (f *keepFake) dropped() []dropIn {
	f.mu.Lock()
	defer f.mu.Unlock()

	return append([]dropIn(nil), f.drops...)
}

func (e proposalEnv) proposeKeep(t *testing.T, args string) string {
	t.Helper()

	content, err := assistant.ProposeForTest(
		e.h.App.Assistant,
		t.Context(),
		e.h.OwnerID(),
		e.conversation(t),
		"keep_for_test",
		json.RawMessage(args),
		app.ProposalMeta{},
	)
	if err != nil {
		t.Fatal(err)
	}

	var out proposed
	if err := json.Unmarshal(content, &out); err != nil {
		t.Fatal(err)
	}

	return out.ID
}

func (e proposalEnv) undo(id, reason string) apitest.Response {
	return e.h.Do(
		http.MethodPost,
		"/api/v1/assistant/proposals/"+id+"/undo",
		map[string]string{"reason": reason},
	)
}
