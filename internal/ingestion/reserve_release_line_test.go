package ingestion_test

import (
	"testing"
	"time"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
)

// S738 (A268): a release line and the withdrawal line beside it are one withdrawal of the
// reserve, booked when both reported balances confirm it.
func TestS738ReserveReleaseLine(t *testing.T) {
	t.Parallel()

	t.Run("the reserve keeps part of the withdrawal", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.withdrawal("2026-11-11T14:11:51.011Z", "rel-1", "-997.48", "wd-1", "980.44")
		f.report("2026-11-11", "1480.49", "2.52", "8000.00")

		f.sync()

		f.assertStates(map[string]string{"wd-1": "created", "rel-1": "discarded"})
		f.assertClean()
		f.assertWithdrawal("wd-1", 98044, -99748, 1704)

		transactions := transactionCount(t, f.h)
		f.sync()

		if got := transactionCount(t, f.h); got != transactions {
			t.Fatalf("transactions %d → %d after a repeated sync", transactions, got)
		}
	})

	t.Run("two withdrawals and the yield lines of the day", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own", "0.09", "cofrinho", "0.55", "algum", "4.34")
		f.withdrawal("2026-11-11T14:11:51.011Z", "rel-1", "-300.00", "wd-1", "291.00")
		f.withdrawal("2026-11-11T14:28:54.963Z", "rel-2", "-1.00", "wd-2", "0.66")
		f.report("2026-11-11", "791.80", "699.55", "8004.34")

		f.sync()

		f.assertStates(map[string]string{
			"wd-1": "created", "rel-1": "discarded",
			"wd-2": "created", "rel-2": "discarded",
			"own": "created", "cofrinho": "discarded", "algum": "discarded",
		})
		f.assertClean()
		f.assertWithdrawal("wd-1", 29100, -30000, 900)
		f.assertWithdrawal("wd-2", 66, -100, 34)
	})

	t.Run("the reserve keeps nothing", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.withdrawal("2026-11-11T14:11:51.011Z", "rel-1", "-250.00", "wd-1", "250.00")
		f.report("2026-11-11", "750.05", "750.00", "8000.00")

		f.sync()

		f.assertStates(map[string]string{"wd-1": "created", "rel-1": "discarded"})
		f.assertClean()
		f.assertWithdrawal("wd-1", 25000, -25000, 0)
	})
}

// S739 (A268): a release line that a reported balance does not confirm waits for review, and
// its withdrawal line is the transfer of D4.
func TestS739UnconfirmedReleaseLine(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name, checking, cofrinho string
	}{
		{"the bank's balance holds the release line", "483.01", "19.56"},
		{"the reserve's amount lacks the release line", "1480.49", "19.56"},
		{"the bank's balance holds it and the reserve's amount lacks it", "483.01", "2.52"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newYieldFixture(t)
			f.withdrawal("2026-11-11T14:11:51.011Z", "rel-1", "-997.48", "wd-1", "980.44")
			f.report(
				"2026-11-11",
				pluggy.Decimal(tt.checking),
				pluggy.Decimal(tt.cofrinho),
				"8000.00",
			)

			f.sync()

			f.assertStates(map[string]string{"wd-1": "created", "rel-1": "needs_review"})
			f.assertWithdrawal("wd-1", 98044, -98044, 0)

			if reason, _ := f.recordFacts("rel-1"); reason != "reserve_release" {
				t.Fatalf("review_reason = %q, want reserve_release", reason)
			}

			f.sync()
			f.assertStates(map[string]string{"rel-1": "needs_review"})
		})
	}
}

// S740 (A268): a release line with two withdrawal lines in its window pairs with none.
func TestS740AmbiguousReleaseLine(t *testing.T) {
	t.Parallel()
	f := newYieldFixture(t)
	f.withdrawal("2026-11-11T14:11:51.011Z", "rel-1", "-997.48", "wd-1", "980.44")
	f.p.AddTransaction(yieldChecking, withdrawalLine("wd-2", "2026-11-11T14:11:52.500Z", "980.44"))
	f.report("2026-11-11", "2460.93", "-960.88", "8000.00")

	f.sync()

	f.assertStates(map[string]string{
		"wd-1": "created", "wd-2": "created", "rel-1": "needs_review",
	})
}

// withdrawal serves a release line at the source timestamp at and the withdrawal line of
// "Cofrinho Mercado Livre" 211 ms after it.
func (f yieldFixture) withdrawal(
	at, release string,
	gross pluggy.Decimal,
	id string,
	net pluggy.Decimal,
) {
	f.p.AddTransaction(yieldChecking, pluggy.Transaction{
		ID:            release,
		Description:   "Liberação de dinheiro",
		Amount:        gross,
		CurrencyCode:  "BRL",
		Date:          at,
		Status:        "POSTED",
		CategoryID:    new("03000000"),
		OperationType: new("OUTROS"),
	})

	ts, err := time.Parse(time.RFC3339Nano, at)
	if err != nil {
		f.h.T().Fatal(err)
	}

	f.p.AddTransaction(
		yieldChecking,
		withdrawalLine(id, ts.Add(211*time.Millisecond).Format(time.RFC3339Nano), net),
	)
}

func withdrawalLine(id, at string, amount pluggy.Decimal) pluggy.Transaction {
	return pluggy.Transaction{
		ID:            id,
		Description:   "Dinheiro retirado Cofrinho Mercado Livre",
		Amount:        amount,
		CurrencyCode:  "BRL",
		Date:          at,
		Status:        "POSTED",
		CategoryID:    new("05060000"),
		OperationType: new("TRANSFERENCIA_SALDO_RESERVADO"),
	}
}

// assertWithdrawal expects the transaction of the withdrawal line to credit net to the checking
// account, debit gross to the reserve and book the rest against the system account Yield.
func (f yieldFixture) assertWithdrawal(id string, net, gross, retained int64) {
	f.h.T().Helper()

	_, txID := f.recordOf(id)
	tx := f.h.Transaction(txID)

	yield := f.text(
		`SELECT id::text FROM ledger_account WHERE system_role = 'yield' AND books_id = `+
			`(SELECT books_id FROM ledger_account WHERE id = $1)`,
		f.checking,
	)

	want := map[string]int64{f.checking: net, f.cofrinho: gross, yield: retained}
	postings := 2
	if retained != 0 {
		postings = 3
	}

	if len(tx.Postings) != postings {
		f.h.T().Fatalf("postings of %s = %+v, want %d", id, tx.Postings, postings)
	}

	for account, amount := range want {
		if got := postingOf(tx, account); got != amount {
			f.h.T().Fatalf("posting of %s on %s = %d, want %d", id, account, got, amount)
		}
	}
}
