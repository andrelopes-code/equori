package domain

import (
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestPropose(t *testing.T) {
	tests := []struct {
		name string
		in   []StoredMovement
		want []Proposal
	}{
		{
			name: "full life of an investment",
			in: []StoredMovement{
				storedMovement("a", MovementBuy, "2026-01-10", 100000),
				storedMovement("b", MovementBuy, "2026-02-10", 50000),
				storedMovement("c", MovementIncome, "2026-03-01", 1234),
				storedMovement("d", MovementSell, "2026-06-10", 60000),
				storedMovement("e", MovementTax, "2026-06-11", 300),
				storedMovement("f", MovementTax, "2026-06-20", 50),
				storedMovement("g", MovementAmortization, "2026-07-01", 1000),
			},
			want: []Proposal{
				{Kind: ProposalApplication, SaleIndex: -1},
				{Kind: ProposalContribution, SaleIndex: -1},
				{Kind: ProposalIncome, SaleIndex: -1},
				{Kind: ProposalSale, Taxes: 300, SaleIndex: -1},
				{Kind: ProposalTaxOfSale, SaleIndex: 3},
				{Kind: ProposalNone, SaleIndex: -1},
				{Kind: ProposalNone, SaleIndex: -1},
			},
		},
		{
			name: "tax between two sales attaches to the nearer",
			in: []StoredMovement{
				storedMovement("a", MovementBuy, "2026-01-10", 100000),
				storedMovement("b", MovementSell, "2026-06-10", 10000),
				storedMovement("c", MovementTax, "2026-06-12", 70),
				storedMovement("d", MovementSell, "2026-06-13", 10000),
			},
			want: []Proposal{
				{Kind: ProposalApplication, SaleIndex: -1},
				{Kind: ProposalSale, SaleIndex: -1},
				{Kind: ProposalTaxOfSale, SaleIndex: 3},
				{Kind: ProposalSale, Taxes: 70, SaleIndex: -1},
			},
		},
		{
			name: "transfer proposes nothing",
			in:   []StoredMovement{storedMovement("a", MovementTransfer, "2026-01-10", 5)},
			want: []Proposal{{Kind: ProposalNone, SaleIndex: -1}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Propose(tt.in); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("Propose = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func storedMovement(id, kind, date string, amount int64) StoredMovement {
	on, err := time.Parse(time.DateOnly, date)
	if err != nil {
		panic(err)
	}

	m, err := money.New(amount, "BRL")
	if err != nil {
		panic(err)
	}

	return StoredMovement{
		ExternalID: id,
		Kind:       kind,
		Date:       on,
		Amount:     m,
		State:      MovementPending,
	}
}
