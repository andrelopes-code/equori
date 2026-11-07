package pluggy_test

import (
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/aggregatortest"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client/pluggytest"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

const (
	conformanceClient  = "client-conformance"
	conformanceSecret  = "secret-conformance"
	conformanceItem    = "item-conformance"
	conformanceAccount = "account-conformance"
	conformanceReserve = "reserve-conformance"
	reserveOperation   = "TRANSFERENCIA_SALDO_RESERVADO"
)

// S348 (A211): the Pluggy port meets the contract of an aggregator.
func TestS348Conformance(t *testing.T) {
	aggregatortest.Run(t, func(t *testing.T) aggregatortest.Backend {
		t.Helper()

		return newPluggyBackend(t)
	})
}

type pluggyBackend struct {
	server  *pluggytest.Server
	port    *pluggy.Port
	account string
}

func newPluggyBackend(t *testing.T) *pluggyBackend {
	t.Helper()

	s := pluggytest.New(t, conformanceClient, conformanceSecret)
	clk := clock.New(func() time.Time { return time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC) })

	port, err := pluggy.NewPort(s.URL(), s.HTTPClient(), clk)
	if err != nil {
		t.Fatal(err)
	}

	updated := "2026-11-12T06:00:00.000Z"
	s.AddItem(client.Item{ID: conformanceItem, Status: client.StatusUpdated, LastUpdatedAt: &updated})
	s.AddAccount(conformanceItem, client.Account{
		ID: conformanceAccount, Type: "BANK", Subtype: client.SubtypeChecking, Name: "Checking",
		Number: "0001/1", Balance: "10.00", CurrencyCode: "BRL",
	})
	s.AddReservedBalance(conformanceAccount, client.ReservedBalance{
		Name: "Reserve", Identification: conformanceReserve,
		AvailableAmounts: []client.ReservedAmount{{Amount: "1.00", CurrencyCode: "BRL"}},
	})

	return &pluggyBackend{server: s, port: port, account: conformanceAccount}
}

func (b *pluggyBackend) Aggregator() app.Aggregator { return b.port }

func (b *pluggyBackend) Credentials() domain.Credentials {
	return domain.Credentials{"client_id": conformanceClient, "client_secret": conformanceSecret}
}

func (b *pluggyBackend) ItemID() string { return conformanceItem }

func (b *pluggyBackend) AccountID() string { return b.account }

func (b *pluggyBackend) RenameAccount(name string) { b.server.RenameAccount(b.account, name) }

func (b *pluggyBackend) RemoveAccount() {
	b.server.ChangeAccountID(b.account, b.account+"-other")
	b.account += "-other"
}

func (b *pluggyBackend) AddLine(id string) {
	b.server.AddTransaction(b.account, b.transaction(id, "Bakery", nil))
}

func (b *pluggyBackend) HasReserves() bool { return true }

func (b *pluggyBackend) ReserveID() string { return conformanceReserve }

func (b *pluggyBackend) RenameReserve(name string) {
	b.server.RenameReservedBalance(b.account, conformanceReserve, name)
}

func (b *pluggyBackend) AddReserveLine(id, name string) {
	operation := reserveOperation
	b.server.AddTransaction(b.account, b.transaction(id, "Dinheiro reservado "+name, &operation))
}

func (b *pluggyBackend) AddUnreadableReserveLine(id string) {
	operation := reserveOperation
	b.server.AddTransaction(b.account, b.transaction(id, "Movimentação entre saldos", &operation))
}

func (b *pluggyBackend) transaction(id, description string, operation *string) client.Transaction {
	return client.Transaction{
		ID: id, Description: description, Amount: "-1.00", CurrencyCode: "BRL",
		Date: "2026-11-12T00:00:00.000Z", Status: "POSTED", OperationType: operation,
	}
}
