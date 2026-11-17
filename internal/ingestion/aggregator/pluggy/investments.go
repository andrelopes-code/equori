package pluggy

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	typeFixedIncome = "fixed_income"
	indexCDI        = "cdi"
	indexIPCA       = "ipca"
	basisPoints     = 100
	fullIndexBP     = 10000
)

var investmentSubtypes = map[string]string{
	"CDB": "cdb", "LCI": "lci", "LCA": "lca", "LC": "lc", "CRI": "cri", "CRA": "cra",
	"DEBENTURES": "debenture", "LIG": "lig", "TREASURY": "tesouro", "LF": "lf",
}

var movementKinds = map[string]string{
	"BUY": domain.MovementBuy, "SELL": domain.MovementSell, "INTEREST": domain.MovementIncome,
	"TAX": domain.MovementTax, "AMORTIZATION": domain.MovementAmortization,
	"TRANSFER": domain.MovementTransfer,
}

// Investments reads the fixed income investments of an item with their movements. Other
// investment types are left out (A236).
func (p Port) Investments(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
	itemID string,
) ([]domain.ExternalInvestment, error) {
	var out []domain.ExternalInvestment

	err := p.session(ctx, id, c, func(s *client.Session) error {
		invs, err := s.Investments(ctx, itemID)
		if err != nil {
			return err
		}

		out = out[:0]

		for _, inv := range invs {
			if inv.Type != client.TypeFixedIncome {
				continue
			}

			ts, err := s.InvestmentTransactions(ctx, inv.ID)
			if err != nil {
				return err
			}

			e, err := externalInvestment(inv, ts)
			if err != nil {
				return err
			}

			out = append(out, e)
		}

		return nil
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return nil, fmt.Errorf("%w: the item is gone", app.ErrAggregatorUnavailable)
	}

	return out, err
}

func externalInvestment(
	inv client.Investment,
	ts []client.InvestmentTransaction,
) (domain.ExternalInvestment, error) {
	cur := money.Currency(inv.CurrencyCode)

	balance, err := minor(inv.Balance, cur)
	if err != nil {
		return domain.ExternalInvestment{}, fmt.Errorf("pluggy investment balance: %w", err)
	}

	balanceDate, err := instantDate(inv.Date)
	if err != nil {
		return domain.ExternalInvestment{}, fmt.Errorf("pluggy investment date: %w", err)
	}

	e := domain.ExternalInvestment{
		ID: inv.ID, Type: typeFixedIncome, Subtype: investmentSubtypes[inv.Subtype],
		Name: inv.Name, Issuer: inv.Issuer, Quantity: string(inv.Quantity),
		Balance: balance, BalanceDate: balanceDate,
		IssuedOn: optionalDate(inv.IssueDate), MaturesOn: optionalDate(inv.DueDate),
	}
	if digits := cnpjDigits(inv.IssuerCNPJ); digits != "" {
		e.IssuerScheme, e.IssuerID = "cnpj", digits
	}

	setTerms(&e, inv)

	for _, t := range ts {
		m, ok, err := externalMovement(t, cur)
		if err != nil {
			return domain.ExternalInvestment{}, err
		}

		if ok {
			e.Movements = append(e.Movements, m)
		}
	}

	return e, nil
}

// setTerms reads the contract terms from the rate; any other rate type leaves the
// investment without terms.
func setTerms(e *domain.ExternalInvestment, inv client.Investment) {
	spread := rateBP(inv.FixedAnnualRate)

	switch inv.RateType {
	case "CDI":
		e.IndexID, e.PercentOfIndexBP, e.SpreadBP = indexCDI, rateBP(inv.Rate), spread
		e.HasTerms = true
	case "IPCA":
		e.IndexID, e.PercentOfIndexBP, e.SpreadBP = indexIPCA, fullIndexBP, spread
		e.HasTerms = true
	case "":
		if inv.FixedAnnualRate != "" {
			e.SpreadBP, e.HasTerms = spread, true
		}
	}
}

// externalMovement maps a movement; ok is false for a type the port does not know.
func externalMovement(
	t client.InvestmentTransaction,
	cur money.Currency,
) (m domain.ExternalMovement, ok bool, err error) {
	kind, known := movementKinds[t.Type]
	if !known {
		return m, false, nil
	}

	when := t.Date
	if t.TradeDate != nil && *t.TradeDate != "" {
		when = *t.TradeDate
	}

	date, err := instantDate(when)
	if err != nil {
		return m, false, fmt.Errorf("pluggy investment movement date: %w", err)
	}

	amount, err := minor(t.Amount, cur)
	if err != nil {
		return m, false, fmt.Errorf("pluggy investment movement amount: %w", err)
	}

	return domain.ExternalMovement{
		ID: t.ID, Kind: kind, Date: date, Quantity: string(t.Quantity), Amount: amount,
	}, true, nil
}

func minor(d client.Decimal, cur money.Currency) (money.Money, error) {
	n, err := client.Rounded(d, cur.MinorUnits())
	if err != nil {
		return money.Money{}, err
	}

	return money.New(n, cur)
}

// rateBP converts a percent rate to basis points, rounded half to even; an absent rate is 0.
func rateBP(d client.Decimal) int {
	r, ok := new(big.Rat).SetString(string(d))
	if d == "" || !ok {
		return 0
	}

	r.Mul(r, big.NewRat(basisPoints, 1))

	q, rem := new(big.Int).QuoRem(r.Num(), r.Denom(), new(big.Int))
	twice := new(big.Int).Mul(rem.Abs(rem), big.NewInt(2))

	if c := twice.Cmp(r.Denom()); c > 0 || c == 0 && q.Bit(0) == 1 {
		if r.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}

	return int(q.Int64())
}

// instantDate reads the calendar day of an RFC 3339 instant as written, without a zone shift.
func instantDate(v string) (time.Time, error) {
	if len(v) < len(time.DateOnly) {
		return time.Time{}, fmt.Errorf("%q is not a date", v)
	}

	return time.Parse(time.DateOnly, v[:len(time.DateOnly)])
}

func optionalDate(v *string) *time.Time {
	if v == nil {
		return nil
	}

	d, err := instantDate(*v)
	if err != nil {
		return nil
	}

	return &d
}

func cnpjDigits(v string) string {
	return strings.NewReplacer(".", "", "/", "", "-", "").Replace(v)
}
