package ingestion_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

const (
	holderCPF       = "529.982.247-25"
	holderDigestHex = "79356df8292712e305b550373e815f99f39284e6fb35d701f636add4e2a71678"
	thirdPartyCPF   = "111.444.777-35"
	maskedCPF       = "***.982.247-**"

	thirdPartyDigestHex = "91fe97f78ba094ba595018b806102a0f3656f689d9a414c33889f035d5681409"
)

// A217: both checking accounts store the digest of their holder; the card account stores none.
func TestHolderDigestStored(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	f.sync(f.nubank)
	f.sync(f.mercadoPago)

	for _, c := range []connectionView{f.nubank, f.mercadoPago} {
		for subtype, want := range map[string]string{pluggy.SubtypeChecking: holderDigestHex, pluggy.SubtypeCard: ""} {
			if got := f.holderDigest(c.ID, subtype); got != want {
				t.Errorf("%s %s holder_digest = %q, want %q", c.ID, subtype, got, want)
			}
		}
	}
}

// A217 rule 1: a listing that reports a holder replaces the stored digest; one without keeps it.
func TestHolderReportedAgain(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		taxNumber string
		want      string
	}{
		{"another holder", thirdPartyCPF, thirdPartyDigestHex},
		{"no holder", "", holderDigestHex},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newPairingFixture(t)
			f.sync(f.nubank)

			f.p.SetAccountTaxNumber(nubankItem+"-checking", tt.taxNumber)
			f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T07:00:00.000Z")
			f.sync(f.nubank)

			if got := f.holderDigest(f.nubank.ID, pluggy.SubtypeChecking); got != tt.want {
				t.Fatalf("holder_digest = %q, want %q", got, tt.want)
			}
		})
	}
}

// A217 rule 4: the counterparty of a line against the holders of the book.
func TestCounterpartyAtImport(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		line pluggy.Transaction
		want string
	}{
		{"receiver holder", pixLine("cp-holder", "2026-11-05", "-10.00", cpf(holderCPF)), "holder"},
		{"payer third party", pixLine("cp-third", "2026-11-06", "20.00", cpf(thirdPartyCPF)), "third_party"},
		{"payer masked", pixLine("cp-masked", "2026-11-07", "30.00", cpf(maskedCPF)), ""},
		{"no payment data", bankLine("cp-none", "2026-11-08", "-40.00"), ""},
	}

	f := newPairingFixture(t)
	for _, tt := range tests {
		f.p.AddTransaction(nubankItem+"-checking", tt.line)
	}

	f.sync(f.nubank)

	for _, tt := range tests {
		if got := f.counterparty(tt.line.ID); got != tt.want {
			t.Errorf("%s: counterparty = %q, want %q", tt.name, got, tt.want)
		}
	}
}

// A217 rule 4, shared book: the holder of another mapped account counts as a holder.
func TestCounterpartyOfAnotherHolder(t *testing.T) {
	t.Parallel()

	f := newPairingFixtureOf(t, thirdPartyCPF, true)
	f.p.AddTransaction(nubankItem+"-checking", pixLine("cp-other", "2026-11-05", "-10.00", cpf(thirdPartyCPF)))
	f.sync(f.nubank)

	if got := f.counterparty("cp-other"); got != "holder" {
		t.Fatalf("counterparty = %q, want holder", got)
	}
}

// A217 rule 4: a stored counterparty is not revised when a holder is mapped later.
func TestCounterpartyNotRevised(t *testing.T) {
	t.Parallel()

	f := newPairingFixtureOf(t, thirdPartyCPF, false)
	f.p.AddTransaction(nubankItem+"-checking", pixLine("cp-late", "2026-11-05", "10.00", cpf(thirdPartyCPF)))
	f.sync(f.nubank)

	if got := f.counterparty("cp-late"); got != "third_party" {
		t.Fatalf("counterparty before mapping = %q, want third_party", got)
	}

	ext := externalAccount(f.mercadoPago, pluggy.SubtypeChecking)
	body := map[string]any{"account_id": f.mpLedger, "sync_from": "2026-10-01"}

	if r := f.mapAccount(f.h.Client, f.mercadoPago.ID, ext.ID, body); r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}

	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T07:00:00.000Z")
	f.sync(f.nubank)

	if got := f.counterparty("cp-late"); got != "third_party" {
		t.Fatalf("counterparty after mapping = %q, want third_party", got)
	}
}

type pairingFixture struct {
	aggregator

	nubank      connectionView
	mercadoPago connectionView

	nubankLedger string
	cardLedger   string
	mpLedger     string
}

func newPairingFixture(t *testing.T, opts ...apitest.Option) pairingFixture {
	return newPairingFixtureOf(t, holderCPF, true, opts...)
}

// newPairingFixtureOf sets the holder the Mercado Pago checking account reports and whether
// the fixture maps it.
func newPairingFixtureOf(t *testing.T, mpHolder string, mapMP bool, opts ...apitest.Option) pairingFixture {
	t.Helper()

	a := newAggregator(t, opts...)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	a.serveItem(pluggyClient, mercadoPagoItem, "Mercado Pago")
	a.p.SetAccountTaxNumber(nubankItem+"-checking", holderCPF)
	a.p.SetAccountTaxNumber(mercadoPagoItem+"-checking", mpHolder)
	a.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "0"})

	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := pairingFixture{
		aggregator:  a,
		nubank:      a.mustConnect(a.h.Client, in.ID, nubankItem),
		mercadoPago: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem),
	}

	brl := map[string]any{"currency": "BRL"}
	f.nubankLedger = a.h.Account("Nubank", "asset", "checking", brl)
	f.cardLedger = a.h.Account("Nubank Gold", "liability", "credit_card", brl)
	f.mpLedger = a.h.Account("Mercado Pago", "asset", "checking", brl)
	a.h.MustDo(http.MethodPost, "/api/v1/accounts/"+f.cardLedger+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "closing_day": 3, "due_day": 10, "closing_day_assignment": "next",
	}, http.StatusCreated, nil)

	f.mapTo(f.nubank, pluggy.SubtypeChecking, f.nubankLedger)
	f.mapTo(f.nubank, pluggy.SubtypeCard, f.cardLedger)

	if mapMP {
		f.mapTo(f.mercadoPago, pluggy.SubtypeChecking, f.mpLedger)
	}

	return f
}

func (f pairingFixture) mapTo(c connectionView, subtype, account string) {
	f.h.T().Helper()

	body := map[string]any{"account_id": account, "sync_from": "2026-10-01"}
	if r := f.mapAccount(f.h.Client, c.ID, externalAccount(c, subtype).ID, body); r.Status != http.StatusOK {
		f.h.T().Fatalf("map status %d: %s", r.Status, r.Body)
	}
}

func (f pairingFixture) sync(c connectionView) {
	f.h.T().Helper()

	if err := f.h.App.Ingestion.SyncConnection(f.h.T().Context(), f.h.OwnerID(), uuid.MustParse(c.ID)); err != nil {
		f.h.T().Fatalf("sync: %v", err)
	}
}

// holderDigest returns the hex digest stored for the account of a connection; "" when null.
func (f pairingFixture) holderDigest(connectionID, subtype string) string {
	f.h.T().Helper()

	var digest *string

	err := f.h.Pool.QueryRow(f.h.T().Context(),
		`SELECT encode(holder_digest, 'hex') FROM ingestion_external_account WHERE connection_id = $1 AND subtype = $2`,
		connectionID, subtype).Scan(&digest)
	if err != nil {
		f.h.T().Fatal(err)
	}

	if digest == nil {
		return ""
	}

	return *digest
}

// counterparty returns the stored counterparty of a record; "" when null.
func (f pairingFixture) counterparty(externalID string) string {
	f.h.T().Helper()

	var cp *string

	err := f.h.Pool.QueryRow(f.h.T().Context(),
		`SELECT counterparty FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&cp)
	if err != nil {
		f.h.T().Fatal(err)
	}

	if cp == nil {
		return ""
	}

	return *cp
}

func cpf(value string) *pluggy.DocumentNumber {
	return &pluggy.DocumentNumber{Type: "CPF", Value: value}
}

// pixLine builds a bank line whose receiver (amount below zero) or payer (above zero) is party.
func pixLine(id, date string, amount pluggy.Decimal, party *pluggy.DocumentNumber) pluggy.Transaction {
	line := bankLine(id, date, amount)
	pd := &pluggy.PaymentData{}

	if strings.HasPrefix(string(amount), "-") {
		pd.Receiver = &pluggy.PaymentParty{DocumentNumber: party}
	} else {
		pd.Payer = &pluggy.PaymentParty{DocumentNumber: party}
	}

	line.PaymentData = pd

	return line
}
