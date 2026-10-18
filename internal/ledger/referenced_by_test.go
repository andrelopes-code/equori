package ledger_test

import (
	"net/http"
	"reflect"
	"sort"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type referenceView struct {
	Type   string `json:"type"`
	Source string `json:"source"`
}

type referencedView struct {
	ID           string           `json:"id"`
	ReferencedBy *[]referenceView `json:"referenced_by"`
}

func getReferencedBy(t *testing.T, c cardSetup, id string) []referenceView {
	t.Helper()
	r := c.h.Do(http.MethodGet, "/api/v1/transactions/"+id, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("get transaction status = %d, body = %s", r.Status, r.Body)
	}
	var v referencedView
	r.Decode(t, &v)
	if v.ReferencedBy == nil {
		t.Fatalf("referenced_by absent for %s, want an array", id)
	}
	return *v.ReferencedBy
}

func sourcesOf(refs []referenceView, linkType string) []string {
	var out []string
	for _, r := range refs {
		if r.Type == linkType {
			out = append(out, r.Source)
		}
	}
	sort.Strings(out)
	return out
}

func TestReferencedBy(t *testing.T) {
	t.Run("S08 refunds reference the laptop and a voided refund drops out", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		laptop := installmentPurchase(t, c.h, map[string]any{
			"card_account_id": c.card, "date": "2026-10-20",
			"splits": []map[string]any{{"account_id": c.h.Account("Electronics", "expense", "", nil), "amount": apitest.BRL(100000)}}, "installment_count": 3,
		})
		var first, second apitest.TransactionView
		refund(c.h, laptop.Transaction.ID, "2026-11-15", 5000).Decode(t, &first)
		refund(c.h, laptop.Transaction.ID, "2026-11-16", 10000).Decode(t, &second)
		if first.ID == "" || second.ID == "" {
			t.Fatalf("refund ids = %q, %q", first.ID, second.ID)
		}

		refs := getReferencedBy(t, c, laptop.Transaction.ID)
		want := []string{first.ID, second.ID}
		sort.Strings(want)
		if len(refs) != 2 || !reflect.DeepEqual(sourcesOf(refs, "refund_of"), want) {
			t.Fatalf("referenced_by = %+v, want two refund_of with sources %v", refs, want)
		}
		if refs[0].Source > refs[1].Source {
			t.Fatalf("referenced_by = %+v, want ordered by source", refs)
		}

		c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+first.ID+"/void", map[string]string{"reason": "mistake"}, http.StatusOK, nil)
		refs = getReferencedBy(t, c, laptop.Transaction.ID)
		if len(refs) != 1 || refs[0].Type != "refund_of" || refs[0].Source != second.ID {
			t.Fatalf("referenced_by after void = %+v, want refund_of %s", refs, second.ID)
		}
	})

	t.Run("S13 won dispute references the purchase through the chargeback", func(t *testing.T) {
		c := newCardSetup(t, "2026-12-05")
		charge := c.purchase("2026-10-14", 19990)
		d := openDispute(t, c.h, charge)
		var resolved disputeView
		c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolve",
			map[string]any{"resolved_on": "2026-12-02", "outcome": "won", "statement": "2026-12"}, http.StatusOK, &resolved)

		refs := getReferencedBy(t, c, charge)
		want := []referenceView{{Type: "chargeback_of", Source: resolved.RefundTransactionID}}
		if resolved.RefundTransactionID == "" || !reflect.DeepEqual(refs, want) {
			t.Fatalf("referenced_by = %+v, want %+v", refs, want)
		}
	})

	t.Run("no inbound link yields an empty array", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		refs := getReferencedBy(t, c, c.purchase("2026-10-14", 23000))
		if refs == nil || len(refs) != 0 {
			t.Fatalf("referenced_by = %#v, want empty array", refs)
		}
	})

	t.Run("other user and unknown id answer 404", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		charge := c.purchase("2026-10-14", 23000)
		refund(c.h, charge, "2026-10-20", 1000)

		other := c.h.Login("other@example.com")
		c.h.ExpectProblem(c.h.Call(other, http.MethodGet, "/api/v1/transactions/"+charge, nil), http.StatusNotFound, "not_found", "")
		c.h.ExpectProblem(c.h.Do(http.MethodGet, "/api/v1/transactions/00000000-0000-4000-8000-000000000000", nil), http.StatusNotFound, "not_found", "")
	})
}
