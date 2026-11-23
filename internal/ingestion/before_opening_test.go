package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S686 (A263): a file with lines dated before the account's opening date is refused with both
// dates; after the opening moves to the first line, the same file imports whole.
func TestS686LinesBeforeOpening(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account(
		"Nubank checking",
		"asset",
		"checking",
		map[string]any{"opened_on": "2026-10-10"},
	)
	file := apitest.OFX(
		"",
		apitest.OFXLine{Date: "20261012", Amount: "-120.00", FITID: "a1", Name: "Farmácia"},
		apitest.OFXLine{Date: "20261005", Amount: "-19.90", FITID: "a2", Name: "Padaria"},
		apitest.OFXLine{Date: "20261002", Amount: "-30.00", FITID: "a3", Name: "Mercado"},
	)

	r := h.Import(checking, "ofx", "a.ofx", file)

	h.ExpectProblem(r, http.StatusUnprocessableEntity, "lines_before_opening", "")

	var got struct {
		BeforeOpening struct {
			OpenedOn    string `json:"opened_on"`
			FirstLineOn string `json:"first_line_on"`
		} `json:"before_opening"`
	}
	r.Decode(t, &got)

	if b := got.BeforeOpening; b.OpenedOn != "2026-10-10" || b.FirstLineOn != "2026-10-02" {
		t.Fatalf("before_opening = %+v, want 2026-10-10 and 2026-10-02", b)
	}

	h.MustDo(
		http.MethodPatch,
		"/api/v1/accounts/"+checking,
		map[string]any{"opened_on": got.BeforeOpening.FirstLineOn},
		http.StatusOK,
		nil,
	)

	b := mustImport(t, h, checking, "ofx", "a.ofx", file)
	if b.Counts.Created != 3 {
		t.Fatalf("counts = %s, want 3 created", counts(b))
	}
}

// A line the ledger refuses for another reason keeps its own message.
func TestLineAfterClosingIsNotBeforeOpening(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account(
		"Nubank checking",
		"asset",
		"checking",
		map[string]any{"opened_on": "2026-10-01"},
	)
	h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+checking+"/close",
		map[string]any{"closed_on": "2026-10-20"},
		http.StatusOK,
		nil,
	)

	r := h.Import(checking, "ofx", "a.ofx", apitest.OFX(
		"",
		apitest.OFXLine{Date: "20261025", Amount: "-120.00", FITID: "a1", Name: "Farmácia"},
	))

	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "file")
}
