package assistant_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Spec 2026-11-03 §7: a proposal result carries the signals of the lookup.
func TestProposeAttachesSignals(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	e.h.App.Assistant.UseSignals(func(_ context.Context, _ int64, p tool.Preview) ([]assistant.Signal, error) {
		return []assistant.Signal{{Kind: "recurring", Data: json.RawMessage(`{"frequency":"monthly"}`)}}, nil
	})

	got := e.proposeResult(t)
	if len(got.Signals) != 1 || got.Signals[0].Kind != "recurring" {
		t.Fatalf("signals = %+v", got.Signals)
	}
}

func TestProposeSignalsLookupFails(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	e.h.App.Assistant.UseSignals(func(_ context.Context, _ int64, _ tool.Preview) ([]assistant.Signal, error) {
		return nil, errors.New("lookup failed")
	})

	got := e.proposeResult(t)
	if got.Status != "awaiting_confirmation" || got.Signals != nil {
		t.Fatalf("result = %+v", got)
	}
}

type proposeResult struct {
	Status  string `json:"status"`
	Signals []struct {
		Kind string `json:"kind"`
	} `json:"signals"`
}

func (e proposalEnv) proposeResult(t *testing.T) proposeResult {
	t.Helper()

	now := *e.now.Load()

	conv := domain.Conversation{ID: uuid.New(), Title: "t", CreatedAt: now, UpdatedAt: now}
	if err := postgres.NewRepository(e.h.Pool).CreateConversation(t.Context(), e.h.OwnerID(), e.h.MemberIDOf("owner@example.com"), conv); err != nil {
		t.Fatal(err)
	}

	content, err := assistant.ProposeForTest(e.h.App.Assistant, t.Context(), e.h.OwnerID(), conv.ID, "note_for_test", json.RawMessage(`{"text":"x"}`), app.ProposalMeta{})
	if err != nil {
		t.Fatal(err)
	}

	var out proposeResult
	if err := json.Unmarshal(content, &out); err != nil {
		t.Fatal(err)
	}

	return out
}

// A Netflix record after two monthly Netflix purchases reaches the model with a recurring signal.
func TestRecordAfterMonthlyPurchasesCarriesSignal(t *testing.T) {
	t.Parallel()

	result := signalTurn(t, "Netflix", "2026-10-20")

	var out struct {
		Signals []struct {
			Kind string `json:"kind"`
			Data struct {
				Frequency string `json:"frequency"`
			} `json:"data"`
		} `json:"signals"`
	}
	if err := json.Unmarshal(result, &out); err != nil {
		t.Fatal(err)
	}

	if len(out.Signals) != 1 || out.Signals[0].Kind != "recurring" || out.Signals[0].Data.Frequency != "monthly" {
		t.Fatalf("result = %s", result)
	}
}

func TestRecordOneOffCarriesNoSignal(t *testing.T) {
	t.Parallel()

	result := signalTurn(t, "Padaria", "2026-10-20")

	var out map[string]json.RawMessage
	if err := json.Unmarshal(result, &out); err != nil {
		t.Fatal(err)
	}

	if _, ok := out["signals"]; ok || out["status"] == nil {
		t.Fatalf("result = %s", result)
	}
}

// signalTurn records two monthly purchases of Netflix, runs a scripted turn that proposes a record
// of description on date, and returns the proposal result the model received.
func signalTurn(t *testing.T, description, date string) json.RawMessage {
	t.Helper()

	late := &lateProvider{}
	h := apitest.New(t, apitest.LLM(late), apitest.Today("2026-10-23"))
	wallet := h.Account("Wallet", "asset", "cash", nil)
	subs := h.Account("Subscriptions", "expense", "", nil)

	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Netflix"}, http.StatusCreated, &payee)

	for _, d := range []string{"2026-08-20", "2026-09-20"} {
		h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
			"date": d, "description": "Netflix", "payee_id": payee.ID,
			"postings": []any{apitest.Posting(wallet, -5590), apitest.Posting(subs, 5590)},
		}, http.StatusCreated, nil)
	}

	h.Dispatch()

	in := map[string]any{
		"date": date, "description": description, "amount": "55.90", "from_account_id": wallet, "to_account_id": subs,
	}
	if description == "Netflix" {
		in["payee_id"] = payee.ID
	}

	args, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}

	late.p = llmtest.New("aistudio", callStep("record_transaction", string(args)), textStep("ok"))

	if r := sendTurn(h, h.Client, map[string]any{"text": "Registra a compra."}); r.Status != http.StatusOK {
		t.Fatalf("turn status = %d: %s", r.Status, r.Body)
	}

	for _, m := range late.p.Requests()[1].Request.Messages {
		for _, p := range m.Parts {
			if p.ToolResult != nil {
				return p.ToolResult.Content
			}
		}
	}

	t.Fatal("no tool result in the second request")

	return nil
}
