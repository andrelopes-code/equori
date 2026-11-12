package app_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/ledger/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const (
	holdingCode = money.Currency("AUVP11")
	usdQuoted   = money.Currency("USDQ11")
)

type targetFixture struct {
	pool      *pgxpool.Pool
	svc       *app.Service
	booksID   int64
	brokerage domain.Account
	cash      domain.Account
}

func TestResolveTarget(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	tests := []struct {
		name string
		// prepare returns the target; it may create accounts first.
		prepare   func(t *testing.T, f targetFixture) app.Target
		noCash    bool
		wantErr   error
		wantField string
		wantMsg   string
		// wantHoldings is the number of children of the brokerage with the instrument after the call.
		wantHoldings int
	}{
		{
			name: "account_id only",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				h := f.createHolding(t, "XP AUVP11")

				return app.Target{AccountID: h.ID, CashAccountID: f.cash.ID}
			},
			wantHoldings: 1,
		},
		{
			name: "pair creates holding",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				return app.Target{
					BrokerageID: f.brokerage.ID,
					Instrument:  holdingCode,
					Create:      true,
				}
			},
			wantHoldings: 1,
		},
		{
			name: "both forms",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				h := f.createHolding(t, "XP AUVP11")

				return app.Target{
					AccountID:   h.ID,
					BrokerageID: f.brokerage.ID,
					Instrument:  holdingCode,
					Create:      true,
				}
			},
			wantErr:      app.ErrTradeTargetRequired,
			wantHoldings: 1,
		},
		{
			name: "neither form",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				return app.Target{CashAccountID: f.cash.ID, Create: true}
			},
			wantErr: app.ErrTradeTargetRequired,
		},
		{
			name: "two cash accounts, no cash_account_id",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				f.createAccount(
					t,
					domain.Account{Name: "Cash 2", Instrument: "BRL", ParentID: f.brokerage.ID},
				)

				return app.Target{
					BrokerageID: f.brokerage.ID,
					Instrument:  holdingCode,
					Create:      true,
				}
			},
			wantErr: app.ErrBrokerageCashAmbiguous,
		},
		{
			name: "no cash account",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				return app.Target{
					BrokerageID: f.brokerage.ID,
					Instrument:  holdingCode,
					Create:      true,
				}
			},
			noCash:  true,
			wantErr: app.ErrBrokerageCashMissing,
		},
		{
			name: "sell without holding",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				return app.Target{BrokerageID: f.brokerage.ID, Instrument: holdingCode}
			},
			wantErr: app.ErrHoldingNotFound,
		},
		{
			name: "quote currency differs",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				return app.Target{BrokerageID: f.brokerage.ID, Instrument: usdQuoted, Create: true}
			},
			wantErr:   domain.ErrValidation,
			wantField: "instrument",
		},
		{
			name: "closed holding",
			prepare: func(t *testing.T, f targetFixture) app.Target {
				h := f.createHolding(t, "XP AUVP11")
				f.closeAccount(t, h.ID)

				return app.Target{
					BrokerageID: f.brokerage.ID,
					Instrument:  holdingCode,
					Create:      true,
				}
			},
			wantErr:      domain.ErrValidation,
			wantField:    "instrument",
			wantMsg:      "XP AUVP11",
			wantHoldings: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newTargetFixture(t, pool, !tt.noCash)
			target := tt.prepare(t, f)

			accountID, cashID, err := f.svc.ResolveTarget(t.Context(), f.booksID, "BRL", target)

			requireTargetError(t, err, tt.wantErr, tt.wantField, tt.wantMsg)

			holdings := f.holdings(t)
			if len(holdings) != tt.wantHoldings {
				t.Fatalf("holdings = %v, want %d", holdings, tt.wantHoldings)
			}

			if tt.wantErr != nil {
				return
			}

			if accountID != holdings[0] {
				t.Fatalf("account = %s, holdings = %v", accountID, holdings)
			}

			if cashID != f.cash.ID {
				t.Fatalf("cash = %s, want %s", cashID, f.cash.ID)
			}
		})
	}
}

func TestResolveTargetReusesHolding(t *testing.T) {
	t.Parallel()
	f := newTargetFixture(t, pgtest.New(t), true)
	target := app.Target{BrokerageID: f.brokerage.ID, Instrument: holdingCode, Create: true}

	first, _, err := f.svc.ResolveTarget(t.Context(), f.booksID, "BRL", target)
	if err != nil {
		t.Fatal(err)
	}

	second, _, err := f.svc.ResolveTarget(t.Context(), f.booksID, "BRL", target)
	if err != nil {
		t.Fatal(err)
	}

	if first != second {
		t.Fatalf("second = %s, want %s", second, first)
	}

	if holdings := f.holdings(t); len(holdings) != 1 {
		t.Fatalf("holdings = %v", holdings)
	}
}

func TestConcurrentFirstBuysCreateOneHolding(t *testing.T) {
	t.Parallel()
	f := newTargetFixture(t, pgtest.New(t), true)
	target := app.Target{BrokerageID: f.brokerage.ID, Instrument: holdingCode, Create: true}

	var (
		ids   [8]uuid.UUID
		errs  [8]error
		wg    sync.WaitGroup
		start = make(chan struct{})
	)

	warmPool(t, f.pool, len(ids))

	for i := range ids {
		wg.Add(1)

		go func() {
			defer wg.Done()

			<-start

			ids[i], _, errs[i] = f.svc.ResolveTarget(context.Background(), f.booksID, "BRL", target)
		}()
	}

	close(start)
	wg.Wait()

	if err := errors.Join(errs[:]...); err != nil {
		t.Fatalf("errors = %v", err)
	}

	holdings := f.holdings(t)
	if len(holdings) != 1 {
		t.Fatalf("holdings = %v", holdings)
	}

	for _, id := range ids {
		if id != holdings[0] {
			t.Fatalf("ids = %v, holdings = %v", ids, holdings)
		}
	}
}

// warmPool opens n connections first, so concurrent calls overlap instead of queuing on dials.
func warmPool(t *testing.T, pool *pgxpool.Pool, n int) {
	t.Helper()

	conns := make([]*pgxpool.Conn, 0, n)

	for range n {
		c, err := pool.Acquire(t.Context())
		if err != nil {
			t.Fatal(err)
		}

		conns = append(conns, c)
	}

	for _, c := range conns {
		c.Release()
	}
}

func newTargetFixture(t *testing.T, pool *pgxpool.Pool, withCash bool) targetFixture {
	t.Helper()

	_, booksID := pgtest.CreateMember(t, pool)

	_, err := pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('AUVP11', 'reit', 0, 'AUVP11', 'BRL', 'BVMF'), ('USDQ11', 'reit', 0, 'USDQ11', 'USD', 'BVMF')
		ON CONFLICT DO NOTHING`,
	)
	if err != nil {
		t.Fatal(err)
	}

	ins := quotes{holdingCode: "BRL", usdQuoted: "USD"}
	f := targetFixture{
		pool:    pool,
		svc:     app.NewService(postgres.NewRepository(pool, ins), nil, nil, ins, nil, nil, nil),
		booksID: booksID,
	}
	f.brokerage = f.createAccount(t, domain.Account{Name: "XP", Instrument: "BRL"})

	if withCash {
		f.cash = f.createAccount(
			t,
			domain.Account{Name: "Cash", Instrument: "BRL", ParentID: f.brokerage.ID},
		)
	}

	return f
}

func (f targetFixture) createHolding(t *testing.T, name string) domain.Account {
	t.Helper()

	return f.createAccount(
		t,
		domain.Account{Name: name, Instrument: holdingCode, ParentID: f.brokerage.ID},
	)
}

func (f targetFixture) createAccount(t *testing.T, a domain.Account) domain.Account {
	t.Helper()

	a.Class, a.Kind = domain.ClassAsset, domain.KindBrokerage

	got, err := f.svc.CreateAccount(t.Context(), f.booksID, a)
	if err != nil {
		t.Fatalf("create account %q: %v", a.Name, err)
	}

	return got
}

func (f targetFixture) closeAccount(t *testing.T, id uuid.UUID) {
	t.Helper()

	_, err := f.pool.Exec(
		t.Context(),
		`UPDATE ledger_account SET closed_on = opened_on WHERE id = $1`,
		id,
	)
	if err != nil {
		t.Fatal(err)
	}
}

// holdings returns the ids of the children of the brokerage with the instrument holdingCode.
func (f targetFixture) holdings(t *testing.T) []uuid.UUID {
	t.Helper()

	rows, err := f.pool.Query(t.Context(),
		`SELECT id FROM ledger_account WHERE books_id = $1 AND parent_id = $2 AND instrument = $3`,
		f.booksID, f.brokerage.ID, string(holdingCode))
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var ids []uuid.UUID

	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}

		ids = append(ids, id)
	}

	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	return ids
}

func requireTargetError(t *testing.T, err, want error, field, message string) {
	t.Helper()

	if want == nil {
		if err != nil {
			t.Fatalf("err = %v", err)
		}

		return
	}

	if !errors.Is(err, want) {
		t.Fatalf("err = %v, want %v", err, want)
	}

	if field == "" {
		return
	}

	var fe *domain.FieldError
	if !errors.As(err, &fe) || fe.Field != field || !strings.Contains(fe.Message, message) {
		t.Fatalf("err = %v, want field %q with %q", err, field, message)
	}
}

// quotes is an app.Instruments whose instruments are quoted in the mapped currency.
type quotes map[money.Currency]money.Currency

func (q quotes) Instrument(_ context.Context, code money.Currency) (app.Instrument, error) {
	quote, ok := q[code]
	if !ok {
		return app.Instrument{}, app.ErrUnknownInstrument
	}

	return app.Instrument{Code: code, Scale: 0, QuoteCurrency: quote}, nil
}
