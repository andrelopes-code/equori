package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const notesPath = "/api/v1/brokerage-notes"

type noteOut struct {
	Transactions []dayTradeTxFull `json:"transactions"`
}

type dayTradeTxFull struct {
	ID       string       `json:"id"`
	Date     string       `json:"date"`
	Postings []postingOut `json:"postings"`
	Trade    dayTradeOut  `json:"trade"`
}

// A228 IO17, IO18: the costs of 2.51 split 1.25 and 1.26 by the gross of each purchase.
func TestS427BrokerageNote(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", security("VALE3", "stock"),
		http.StatusCreated, nil)

	var out noteOut
	f.h.MustDo(
		http.MethodPost,
		notesPath,
		f.noteBody("2026-11-10", 251, 0,
			f.noteOrder("buy", "PETR4", 100, "30.00"),
			f.noteOrder("buy", "VALE3", 50, "60.10"),
		),
		http.StatusCreated,
		&out,
	)

	if len(out.Transactions) != 2 {
		t.Fatalf("transactions = %d, want 2", len(out.Transactions))
	}

	f.expectCash(t, out.Transactions[0], -300125, "2026-11-12")
	f.expectCash(t, out.Transactions[1], -300626, "2026-11-12")
}

// A228 IO18: a note with one order equals a trade with the costs of the note.
func TestNoteWithOneOrderTakesAllTheCosts(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)

	var out noteOut
	f.h.MustDo(
		http.MethodPost,
		notesPath,
		f.noteBody("2026-11-10", 251, 0, f.noteOrder("buy", "PETR4", 100, "30.00")),
		http.StatusCreated,
		&out,
	)

	f.expectCash(t, out.Transactions[0], -300251, "2026-11-12")
}

// A228 IO19: withheld tax belongs to a sale.
func TestS428NoteTaxesWithoutSale(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)

	r := f.h.Do(
		http.MethodPost,
		notesPath,
		f.noteBody("2026-11-10", 0, 50, f.noteOrder("buy", "PETR4", 100, "30.00")),
	)

	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "taxes")
}

// A228 IO17: the orders of a note are recorded buys first, so a sale can close a later buy.
func TestS429NoteRecordsTheDayInAnyOrder(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.petr4Day(t, "buy", "2026-11-03", 100, "10.00")

	var out noteOut
	f.h.MustDo(
		http.MethodPost,
		notesPath,
		f.noteBody("2026-11-10", 0, 0,
			f.noteOrder("sell", "PETR4", 100, "13.00"),
			f.noteOrder("buy", "PETR4", 100, "12.00"),
		),
		http.StatusCreated,
		&out,
	)

	expectDayTrade(t, dayTradeTx{Trade: out.Transactions[0].Trade}, 120000, 100, 120000)
	f.expectHolding(t, 100, 100000)
}

// A228 IO20: a rejected order leaves no order of the note recorded.
func TestS430NoteIsAllOrNothing(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.petr4Day(t, "buy", "2026-11-03", 100, "10.00")

	r := f.h.Do(
		http.MethodPost,
		notesPath,
		f.noteBody("2026-11-10", 0, 0,
			f.noteOrder("buy", "PETR4", 10, "30.00"),
			f.noteOrder("sell", "PETR4", 500, "30.00"),
		),
	)

	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "orders[1].quantity")

	var txs struct {
		Items []dayTradeTxFull `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions?account_id="+f.petr4+"&limit=100",
		nil,
		http.StatusOK,
		&txs,
	)

	for _, tx := range txs.Items {
		if tx.Date == "2026-11-10" {
			t.Fatalf("transaction %s of the rejected note was recorded", tx.ID)
		}
	}
}

func TestBrokerageNoteRoles(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	body := f.noteBody("2026-11-10", 0, 0, f.noteOrder("buy", "PETR4", 1, "30.00"))
	owner := f.h.OwnerID()

	reader := f.h.JoinAs("reader@example.com", owner, "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPost, notesPath, body),
		http.StatusForbidden, "book_role_required", "",
	)

	for _, role := range []string{"write", "owner"} {
		c := f.h.JoinAs(role+"-user@example.com", owner, role)
		if r := f.h.Call(c, http.MethodPost, notesPath, body); r.Status != http.StatusCreated {
			t.Fatalf("%s status = %d: %s", role, r.Status, r.Body)
		}
	}

	outsider := f.h.LoginMember("outsider@example.com")
	f.h.ExpectProblem(
		f.h.Call(outsider, http.MethodPost, notesPath, body),
		http.StatusUnprocessableEntity, "invalid_account", "brokerage_id",
	)
}

func (f investFixture) noteBody(
	date string,
	fees, taxes int64,
	orders ...map[string]any,
) map[string]any {
	body := map[string]any{
		"brokerage_id": f.xp,
		"date":         date,
		"orders":       orders,
	}
	if fees != 0 {
		body["fees"] = apitest.BRL(fees)
	}

	if taxes != 0 {
		body["taxes"] = apitest.BRL(taxes)
	}

	return body
}

func (f investFixture) noteOrder(side, code string, quantity int64, price string) map[string]any {
	return map[string]any{
		"side":       side,
		"instrument": code,
		"quantity":   units(quantity, code),
		"unit_price": price,
	}
}

func (f investFixture) expectCash(t *testing.T, tx dayTradeTxFull, amount int64, settled string) {
	t.Helper()

	for _, p := range tx.Postings {
		if p.AccountID != f.cash {
			continue
		}

		if p.Amount["amount"] != float64(amount) || p.SettledOn == nil || *p.SettledOn != settled {
			t.Fatalf("cash posting = %v settled %v, want %d settled %s",
				p.Amount, p.SettledOn, amount, settled)
		}

		return
	}

	t.Fatalf("transaction %s has no cash posting", tx.ID)
}
