package ingestion_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
)

const yieldChecking = mercadoPagoItem + "-checking"

// S687 (A264): a yield line of a bank account with reserved balances that equals the yield of a
// reserve belongs to the reserve: it is discarded, and the account keeps its own yield.
func TestS687ReserveYieldLine(t *testing.T) {
	t.Parallel()

	t.Run("the line and the reserve's yield arrive in one sync", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own", "0.09", "cofrinho", "0.55", "algum", "4.34")
		f.report("2026-11-11", "500.14", "1000.55", "8004.34")

		f.sync()

		f.assertStates(map[string]string{
			"own": "created", "cofrinho": "discarded", "algum": "discarded",
		})
		f.assertClean()

		if b := f.batches(f.checking)[0]; b.Counts.Created != 1 || b.Counts.NeedsReview != 0 {
			t.Fatalf("batch = %+v, want one created and none in review", b.Counts)
		}

		for reserve, want := range map[string]int64{f.cofrinho: 55, f.algum: 434} {
			booked := f.yieldTransactions(reserve)
			if len(booked) != 1 || postingOf(booked[0], reserve) != want {
				t.Fatalf("yield of %s = %+v, want %d", reserve, booked, want)
			}
		}

		transactions := transactionCount(t, f.h)
		f.sync()

		if got := transactionCount(t, f.h); got != transactions {
			t.Fatalf("transactions %d → %d after a repeated sync", transactions, got)
		}
	})

	t.Run("the line arrives after the reserve's yield", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own", "0.09")
		f.report("2026-11-11", "500.14", "1000.55", "8004.34")
		f.sync()

		f.yields("2026-11-11", "cofrinho", "0.55", "algum", "4.34")
		f.report("2026-11-12", "500.14", "1000.55", "8004.34")
		f.sync()

		f.assertStates(map[string]string{
			"own": "created", "cofrinho": "discarded", "algum": "discarded",
		})
		f.assertClean()
	})

	t.Run("one reserve difference holds the yield of two days", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own-1", "0.09", "cofrinho-1", "0.54", "algum-1", "4.34")
		f.yields("2026-11-12", "own-2", "0.10", "cofrinho-2", "0.55", "algum-2", "4.35")
		f.report("2026-11-12", "500.24", "1001.09", "8008.69")

		f.sync()

		f.assertStates(map[string]string{
			"own-1": "created", "cofrinho-1": "discarded", "algum-1": "discarded",
			"own-2": "created", "cofrinho-2": "discarded", "algum-2": "discarded",
		})
		f.assertClean()
	})

	t.Run("the bank's balance holds a line that equals a reserve's yield", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own", "0.55")
		f.report("2026-11-11", "500.60", "1000.55", "8004.34")

		f.sync()

		f.assertStates(map[string]string{"own": "created"})
		f.assertClean()
	})
}

// S688 (A264): a yield line that no reserve explains and the reported balance leaves out waits
// for review, and a later sync decides it again.
func TestS688UnexplainedYieldLine(t *testing.T) {
	t.Parallel()

	t.Run("the yield of a reserve that is not mapped", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.p.AddReservedBalance(yieldChecking, reserved("Cofrinho da virada", "res-virada", "40.00"))
		f.yields("2026-11-11", "own", "0.09", "cofrinho", "0.55", "algum", "4.34", "virada", "0.02")
		f.report("2026-11-11", "500.14", "1000.55", "8004.34")

		f.sync()

		f.assertStates(map[string]string{
			"own":      "created",
			"cofrinho": "discarded",
			"algum":    "discarded",
			"virada":   "needs_review",
		})
		f.assertClean()

		held := heldRecord(t, f.syncFixture, f.batches(f.checking)[0].ID)
		if held.ReviewReason != "yield" {
			t.Fatalf("review_reason = %q, want yield", held.ReviewReason)
		}

		f.resolve("virada", map[string]any{"action": "discard"})
		f.sync()
		f.assertStates(map[string]string{"virada": "discarded"})
	})

	t.Run("a balance that explains no line holds the line until it does", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own", "0.09", "cofrinho", "0.55", "algum", "4.34")
		f.report("2026-11-11", "490.14", "1000.55", "8004.34")
		f.sync()

		f.assertStates(map[string]string{
			"own": "needs_review", "cofrinho": "discarded", "algum": "discarded",
		})

		f.p.AddTransaction(yieldChecking, bankLine("purchase", "2026-11-11", "-10.00"))
		f.sync()

		f.assertStates(map[string]string{"own": "created", "purchase": "created"})
		f.sync()
		f.assertClean()
	})

	t.Run("a reserve's yield reported later the same day", func(t *testing.T) {
		t.Parallel()
		f := newYieldFixture(t)
		f.yields("2026-11-11", "own", "0.09", "cofrinho", "0.55")
		f.report("2026-11-11", "500.14", "1000.00", "8000.00")
		f.sync()

		f.assertStates(map[string]string{"own": "created", "cofrinho": "needs_review"})

		f.report("2026-11-11", "500.14", "1000.55", "8000.00")
		f.sync()

		f.assertStates(map[string]string{"own": "created", "cofrinho": "discarded"})
		f.assertClean()
	})
}

// A264: an owner's choice on a discarded yield line is kept by the next sync.
func TestReopenedYieldLine(t *testing.T) {
	t.Parallel()
	f := newYieldFixture(t)
	f.yields("2026-11-11", "own", "0.09", "cofrinho", "0.55")
	f.report("2026-11-11", "500.14", "1000.55", "8000.00")
	f.sync()
	f.assertStates(map[string]string{"cofrinho": "discarded"})

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/external-records/"+f.recordID("cofrinho")+"/reopen",
		nil,
		http.StatusOK,
		nil,
	)
	f.sync()

	f.assertStates(map[string]string{"cofrinho": "needs_review"})
}

// yieldFixture is a Mercado Pago checking account of 500.05 with reserves "Cofrinho Mercado
// Livre" of 1,000.00 and "Algum dinheiro" of 8,000.00, mapped and reconciled on 2026-11-10.
type yieldFixture struct {
	syncFixture
	cofrinho, algum string
}

func newYieldFixture(t *testing.T) yieldFixture {
	t.Helper()
	a := newAggregator(t)
	it := pluggy.Item{
		ID:            mercadoPagoItem,
		Status:        pluggy.StatusUpdated,
		LastUpdatedAt: new("2026-11-10T15:00:00.000Z"),
	}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{
		ID:           yieldChecking,
		Type:         "BANK",
		Subtype:      pluggy.SubtypeChecking,
		Name:         "Mercado Pago",
		Number:       checkingNumber,
		Balance:      "500.05",
		CurrencyCode: "BRL",
	})
	a.p.AddReservedBalance(
		yieldChecking,
		reserved("Cofrinho Mercado Livre", "res-cofrinho", "1000.00"),
	)
	a.p.AddReservedBalance(yieldChecking, reserved("Algum dinheiro", "res-algum", "8000.00"))

	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := yieldFixture{
		syncFixture: syncFixture{
			aggregator: a,
			conn:       a.mustConnect(a.h.Client, in.ID, mercadoPagoItem),
			checking:   a.h.Account("Mercado Pago", "asset", "checking", nil),
		},
		cofrinho: a.h.Account("MP Cofrinho", "asset", "reserve", nil),
		algum:    a.h.Account("MP Algum dinheiro", "asset", "reserve", nil),
	}

	for _, m := range []struct {
		external, ledger string
		opening          int64
	}{
		{externalAccount(f.conn, pluggy.SubtypeChecking).ID, f.checking, 50005},
		{reservedByName(f.conn, "Cofrinho Mercado Livre").ID, f.cofrinho, 100000},
		{reservedByName(f.conn, "Algum dinheiro").ID, f.algum, 800000},
	} {
		a.h.Record(
			"2026-11-09",
			apitest.Posting(m.ledger, m.opening),
			apitest.Posting(openingBalances(f.syncFixture), -m.opening),
		)

		if r := a.mapAccount(
			a.h.Client,
			f.conn.ID,
			m.external,
			map[string]any{"account_id": m.ledger, "sync_from": "2026-11-10"},
		); r.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", r.Status, r.Body)
		}
	}

	f.sync()
	f.assertClean()

	return f
}

// yields serves yield lines of the checking account, as pairs of id and amount. The lines
// carry the same fields whatever balance yielded.
func (f yieldFixture) yields(day string, pairs ...string) {
	for pair := range slices.Chunk(pairs, 2) {
		f.p.AddTransaction(yieldChecking, pluggy.Transaction{
			ID:            pair[0],
			Description:   "Rendimentos",
			Amount:        pluggy.Decimal(pair[1]),
			CurrencyCode:  "BRL",
			Date:          day + "T06:36:34.487Z",
			Status:        "POSTED",
			CategoryID:    new("03060000"),
			Category:      new("Proceeds interests and dividends"),
			OperationType: new("RESGATE_APLIC_FINANCEIRA"),
		})
	}
}

// report sets the balances the item reports on day.
func (f yieldFixture) report(day string, checking, cofrinho, algum pluggy.Decimal) {
	f.p.SetAccountBalance(yieldChecking, checking)
	f.p.SetReservedAmount(yieldChecking, "res-cofrinho", cofrinho)
	f.p.SetReservedAmount(yieldChecking, "res-algum", algum)
	f.p.SetItemUpdatedAt(mercadoPagoItem, day+"T15:00:00.000Z")
}

func (f yieldFixture) assertStates(want map[string]string) {
	f.h.T().Helper()

	for id, state := range want {
		got, tx := f.recordOf(id)
		if got != state || (tx != "") != (state == "created") {
			f.h.T().Fatalf("%s = %s on %q, want %s", id, got, tx, state)
		}
	}
}

// assertClean expects every account to hold the balance the bank reported.
func (f yieldFixture) assertClean() {
	f.h.T().Helper()

	for _, account := range []string{f.checking, f.cofrinho, f.algum} {
		if d := f.openDifference(account); d != nil {
			f.h.T().Fatalf("open difference of %s = %+v, want none", account, d)
		}
	}
}

func postingOf(tx apitest.TransactionView, account string) int64 {
	var total int64
	for _, p := range tx.Postings {
		if p.AccountID == account {
			total += p.Amount.Amount
		}
	}

	return total
}
