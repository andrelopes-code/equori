package pluggy_test

import (
	"context"
	"errors"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy"
	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

var _ app.InvestmentReader = (*pluggy.Port)(nil)

func TestInvestmentsTerms(t *testing.T) {
	tests := []struct {
		name string
		in   client.Investment
		want domain.ExternalInvestment
	}{
		{
			name: "cdb at 110 percent of the cdi",
			in: fixedIncome(
				"CDB", "CDI", "110", "",
			),
			want: domain.ExternalInvestment{
				Subtype: "cdb", IndexID: "cdi", PercentOfIndexBP: 11000, HasTerms: true,
			},
		},
		{
			name: "debenture at ipca plus 6.5",
			in:   fixedIncome("DEBENTURES", "IPCA", "", "6.5"),
			want: domain.ExternalInvestment{
				Subtype: "debenture", IndexID: "ipca", PercentOfIndexBP: 10000,
				SpreadBP: 650, HasTerms: true,
			},
		},
		{
			name: "cdi plus a fixed rate",
			in:   fixedIncome("CDB", "CDI", "100", "1.25"),
			want: domain.ExternalInvestment{
				Subtype: "cdb", IndexID: "cdi", PercentOfIndexBP: 10000,
				SpreadBP: 125, HasTerms: true,
			},
		},
		{
			name: "fixed rate without an index",
			in:   fixedIncome("LCI", "", "", "12.4"),
			want: domain.ExternalInvestment{Subtype: "lci", SpreadBP: 1240, HasTerms: true},
		},
		{
			name: "rate rounds half to even",
			in:   fixedIncome("LCI", "", "", "6.505"),
			want: domain.ExternalInvestment{Subtype: "lci", SpreadBP: 650, HasTerms: true},
		},
		{
			name: "selic has no terms",
			in:   fixedIncome("TREASURY", "SELIC", "100", ""),
			want: domain.ExternalInvestment{Subtype: "tesouro"},
		},
		{
			name: "lf",
			in:   fixedIncome("LF", "", "", ""),
			want: domain.ExternalInvestment{Subtype: "lf"},
		},
		{
			name: "unmapped subtype is empty",
			in:   fixedIncome("CORPORATE_DEBT", "", "", ""),
			want: domain.ExternalInvestment{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newPluggyBackend(t)
			b.server.AddInvestment(conformanceItem, tt.in)

			got := b.investments(t)
			if len(got) != 1 {
				t.Fatalf("returned %d investments, want 1", len(got))
			}

			g := got[0]
			if g.Type != "fixed_income" || g.Subtype != tt.want.Subtype ||
				g.IndexID != tt.want.IndexID ||
				g.PercentOfIndexBP != tt.want.PercentOfIndexBP ||
				g.SpreadBP != tt.want.SpreadBP || g.HasTerms != tt.want.HasTerms {
				t.Fatalf("terms = %+v, want %+v", g, tt.want)
			}
		})
	}
}

func TestInvestmentsFacts(t *testing.T) {
	b := newPluggyBackend(t)
	inv := fixedIncome("CDB", "CDI", "110", "")
	inv.Name = "CDB Bank 110"
	inv.Balance = "2000.55"
	inv.Quantity = "1999.5"
	inv.Date = "2026-02-10T00:00:00.000Z"
	inv.IssueDate = ptr("2026-01-10T00:00:00.000Z")
	inv.DueDate = ptr("2028-01-10T00:00:00.000Z")
	inv.Issuer = "Bank SA"
	inv.IssuerCNPJ = "22.222.222/0001-22"
	b.server.AddInvestment(conformanceItem, inv)
	b.server.AddInvestment(conformanceItem, client.Investment{
		ID: "fund-1", Type: "MUTUAL_FUND", Name: "Fund", CurrencyCode: "BRL", Balance: "5.00",
	})
	b.server.AddInvestmentTransaction("inv-1", client.InvestmentTransaction{
		ID: "m1", Type: "BUY", Date: "2026-01-09T00:00:00.000Z",
		TradeDate: ptr("2026-01-10T00:00:00.000Z"), Quantity: "1000", Amount: "1000.00",
	})
	b.server.AddInvestmentTransaction("inv-1", client.InvestmentTransaction{
		ID: "m2", Type: "SELL", Date: "2026-06-10T00:00:00.000Z", Quantity: "10", Amount: "500.10",
	})

	for i, typ := range []string{"INTEREST", "TAX", "AMORTIZATION", "TRANSFER"} {
		b.server.AddInvestmentTransaction("inv-1", client.InvestmentTransaction{
			ID: "k" + typ, Type: typ, Date: "2026-07-0" + string(rune('1'+i)) + "T00:00:00.000Z",
			Amount: "1.00",
		})
	}

	got := b.investments(t)
	if len(got) != 1 {
		t.Fatalf("returned %d investments, want the fixed income one", len(got))
	}

	g := got[0]
	if g.ID != "inv-1" || g.Name != "CDB Bank 110" || g.Issuer != "Bank SA" ||
		g.IssuerScheme != "cnpj" || g.IssuerID != "22222222000122" || g.Quantity != "1999.5" {
		t.Fatalf("facts = %+v", g)
	}

	if g.Balance.Amount() != 200055 || g.Balance.Currency() != "BRL" ||
		!g.BalanceDate.Equal(day(2026, 2, 10)) {
		t.Fatalf("balance = %v %v on %v", g.Balance.Amount(), g.Balance.Currency(), g.BalanceDate)
	}

	if g.IssuedOn == nil || !g.IssuedOn.Equal(day(2026, 1, 10)) || g.MaturesOn == nil ||
		!g.MaturesOn.Equal(day(2028, 1, 10)) {
		t.Fatalf("issued %v matures %v", g.IssuedOn, g.MaturesOn)
	}

	type movement struct {
		ID, Kind string
		Date     time.Time
		Quantity string
		Amount   int64
	}

	var movements []movement
	for _, m := range g.Movements {
		movements = append(movements, movement{m.ID, m.Kind, m.Date, m.Quantity, m.Amount.Amount()})
	}

	want := []movement{
		{"m1", domain.MovementBuy, day(2026, 1, 10), "1000", 100000},
		{"m2", domain.MovementSell, day(2026, 6, 10), "10", 50010},
		{"kINTEREST", domain.MovementIncome, day(2026, 7, 1), "", 100},
		{"kTAX", domain.MovementTax, day(2026, 7, 2), "", 100},
		{"kAMORTIZATION", domain.MovementAmortization, day(2026, 7, 3), "", 100},
		{"kTRANSFER", domain.MovementTransfer, day(2026, 7, 4), "", 100},
	}
	if !reflect.DeepEqual(movements, want) {
		t.Fatalf("movements = %+v, want %+v", movements, want)
	}
}

func TestInvestmentsFailures(t *testing.T) {
	tests := []struct {
		name   string
		status int
		onList bool
		want   error
	}{
		{"401 on the list", http.StatusUnauthorized, true, app.ErrAggregatorUnauthorized},
		{"401 on the movements", http.StatusUnauthorized, false, app.ErrAggregatorUnauthorized},
		{"500 on the list", http.StatusInternalServerError, true, app.ErrAggregatorUnavailable},
		{
			"500 on the movements", http.StatusInternalServerError, false,
			app.ErrAggregatorUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			b := newPluggyBackend(t)
			b.server.AddInvestment(conformanceItem, fixedIncome("CDB", "CDI", "110", ""))

			if tt.onList {
				b.server.FailInvestments(tt.status)
			} else {
				b.server.FailInvestmentTransactions("inv-1", tt.status)
			}

			_, err := b.port.Investments(
				context.Background(), uuid.Nil, b.Credentials(), conformanceItem,
			)
			if !errors.Is(err, tt.want) {
				t.Fatalf("error = %v, want %v", err, tt.want)
			}
		})
	}
}

func (b *pluggyBackend) investments(t *testing.T) []domain.ExternalInvestment {
	t.Helper()

	got, err := b.port.Investments(context.Background(), uuid.Nil, b.Credentials(), conformanceItem)
	if err != nil {
		t.Fatal(err)
	}

	return got
}

func fixedIncome(subtype, rateType string, rate, fixed client.Decimal) client.Investment {
	return client.Investment{
		ID: "inv-1", Type: "FIXED_INCOME", Subtype: subtype, Name: "Investment",
		CurrencyCode: "BRL", Balance: "100.00", Date: "2026-02-10T00:00:00.000Z",
		RateType: rateType, Rate: rate, FixedAnnualRate: fixed,
	}
}

func day(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func ptr[T any](v T) *T { return &v }
