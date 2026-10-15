package ledger_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Acceptance scenarios of docs/domain/06-scenarios.md that phase P3 covers.

func TestReconciliationScenarios(t *testing.T) {
	t.Run("S24", func(t *testing.T) {
		for _, tc := range []struct {
			name              string
			reported, diff    int64
			yield             bool
			reconciledThrough string
		}{
			{"yield", 1008341, 8341, true, "2026-10-31"},
			{"negative difference waits for the owner", 999000, -1000, false, "2026-10-01"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				f := newFixture(t, apitest.Today("2026-11-05"))
				f.h.Record("2026-09-30", apitest.Posting(f.emergency, 1000000), apitest.Posting(f.openingBalances, -1000000))
				if resp := assertBalance(f.h, f.emergency, "2026-10-01", 1000000); resp.Status != http.StatusCreated {
					t.Fatalf("previous assertion: status %d: %s", resp.Status, resp.Body)
				}
				var res assertionResult
				assertBalance(f.h, f.emergency, "2026-10-31", tc.reported).Decode(t, &res)
				if res.Difference.Amount != tc.diff || (res.ResolutionTransactionID != "") != tc.yield {
					t.Fatalf("result = %+v", res)
				}
				if tc.yield {
					want := map[string]int64{f.emergency: 8341, f.yield: -8341}
					if got := amountsByAccount(f.h.Transaction(res.ResolutionTransactionID)); fmt.Sprint(got) != fmt.Sprint(want) {
						t.Fatalf("yield postings = %v, want %v", got, want)
					}
				}
				s := reconciliationOf(f.h, f.emergency)
				if s.LastReconciledOn != tc.reconciledThrough || (s.OpenDifference == nil) != tc.yield {
					t.Fatalf("reconciliation = %+v", s)
				}
			})
		}
	})

	t.Run("S25", func(t *testing.T) {
		f := newFixture(t, apitest.Today("2026-11-20"))
		f.h.Record("2026-09-30", apitest.Posting(f.emergency, 1000000), apitest.Posting(f.openingBalances, -1000000))
		f.h.Record("2026-11-14", apitest.Posting(f.emergency, -200000), apitest.Posting(f.checking, 199100), apitest.Posting(f.incomeTax, 900))
		f.expectBalances(t, "2026-11-14", map[string]int64{f.emergency: 800000, f.checking: 199100, f.incomeTax: 900})
	})

	t.Run("S26", func(t *testing.T) {
		f := newFixture(t, apitest.Today("2026-11-05"))
		f.h.Record("2026-10-01", apitest.Posting(f.checking, 320327), apitest.Posting(f.salary, -320327))
		var open assertionResult
		assertBalance(f.h, f.checking, "2026-10-31", 320117).Decode(t, &open)
		var res assertionResult
		f.h.MustDo(http.MethodPost, "/api/v1/balance-assertions/"+open.Assertion.ID+"/resolve", map[string]string{"resolution": "adjustment"}, http.StatusOK, &res)
		want := map[string]int64{f.checking: -210, f.adjustments: 210}
		if got := amountsByAccount(f.h.Transaction(res.ResolutionTransactionID)); fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("adjustment postings = %v, want %v", got, want)
		}
		if s := reconciliationOf(f.h, f.checking); s.LastReconciledOn != "2026-10-31" || s.OpenDifference != nil {
			t.Fatalf("reconciliation = %+v", s)
		}
	})

	t.Run("S31", func(t *testing.T) {
		f := newFixture(t)
		supermarket := f.h.Account("Supermarket", "expense", "", map[string]any{"parent_id": f.food})
		purchase := f.h.Record("2026-10-14", apitest.Posting(f.itauVisa, -23000), apitest.Posting(supermarket, 23000))
		other := f.h.Record("2026-10-15", apitest.Posting(f.checking, -5000), apitest.Posting(supermarket, 5000))
		receipt := pdf(230 * 1024)
		first := mustAttach(t, f.h, purchase, "receipt.pdf", receipt)
		second := mustAttach(t, f.h, other, "receipt.pdf", receipt)
		if n := blobCount(t, f.h); n != 1 || first.SHA256 != second.SHA256 {
			t.Fatalf("blobs = %d, hashes %s and %s", n, first.SHA256, second.SHA256)
		}
		for _, tx := range []string{purchase, other} {
			var list struct {
				Items []attachmentView `json:"items"`
			}
			f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+tx+"/attachments", nil, http.StatusOK, &list)
			if len(list.Items) != 1 || list.Items[0].SHA256 != first.SHA256 {
				t.Fatalf("attachments of %s = %+v", tx, list.Items)
			}
		}
		f.h.ExpectProblem(attach(f.h, purchase, "large.pdf", pdf(12*mib)), http.StatusUnprocessableEntity, "validation_failed", "file")
	})
}
