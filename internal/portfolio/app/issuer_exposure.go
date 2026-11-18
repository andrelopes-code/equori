package app

import (
	"cmp"
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// IssuerExposure is the value held with one issuer; Key is empty for holdings without issuer.
// SovereignValue is the part the state of the jurisdiction issues; UncoveredValue is the rest
// outside the guarantee. CoveredValue holds SpecialValue, the part under the special guarantee
// (a DPGE). Limit, the sum of the limits that apply, and Excess, what passes each of them, are
// nil when the book has no guarantee.
type IssuerExposure struct {
	Key, Issuer               string
	MarketValue, CoveredValue money.Money
	SovereignValue            money.Money
	SpecialValue              money.Money
	UncoveredValue            money.Money
	Limit, Excess             *money.Money
}

// Exposure is the fixed income of a book at Date grouped by issuer (A236 FC23).
type Exposure struct {
	Date          time.Time
	Issuers       []IssuerExposure // by market value, largest first; the group without issuer last
	Guarantee     *domain.Guarantee
	PeriodNote    bool // the covered values together exceed the limit of the guarantee period
	MissingPrices []money.Currency
}

// issuerGroup sums the holdings of one issuer key; name is that of its most valuable holding.
type issuerGroup struct {
	IssuerExposure
	best money.Money
}

// IssuerExposure values the fixed income holdings at date in the base currency; a holding
// without a price is listed in MissingPrices and left out of every sum. A zero date is today.
func (s *Service) IssuerExposure(
	ctx context.Context,
	booksID int64,
	date time.Time,
) (Exposure, error) {
	if date.IsZero() {
		date = s.ledger.Today(ctx)
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return Exposure{}, err
	}

	guarantee, err := s.guaranteeIn(ctx, booksID, base)
	if err != nil {
		return Exposure{}, err
	}

	positions, err := s.Positions(ctx, booksID, date, "")
	if err != nil {
		return Exposure{}, err
	}

	out := Exposure{Date: date, Guarantee: guarantee}
	groups := map[string]*issuerGroup{}

	for _, p := range positions {
		info, err := s.md.InstrumentOf(ctx, p.Instrument)
		if err != nil {
			return Exposure{}, err
		}

		switch {
		case info.Type != typeFixedIncome:
		case p.MarketValue == nil:
			if !slices.Contains(out.MissingPrices, p.Instrument) {
				out.MissingPrices = append(out.MissingPrices, p.Instrument)
			}
		default:
			if err := addHolding(groups, base, info, *p.MarketValue, guarantee); err != nil {
				return Exposure{}, err
			}
		}
	}

	if out.Issuers, err = issuerRows(groups, base, guarantee); err != nil {
		return Exposure{}, err
	}

	out.PeriodNote, err = exceedsPeriod(out.Issuers, base, guarantee)

	return out, err
}

// guaranteeIn is the guarantee of the book's jurisdiction; nil when there is none or its limits
// are in another currency than the base.
func (s *Service) guaranteeIn(
	ctx context.Context,
	booksID int64,
	base money.Currency,
) (*domain.Guarantee, error) {
	j, err := s.juris.For(ctx, booksID)
	if err != nil || j == nil {
		return nil, err
	}

	g, ok := j.Guarantee()
	if !ok || g.LimitPerIssuer.Currency() != base || g.LimitPerPeriod.Currency() != base {
		return nil, nil
	}

	return &g, nil
}

func addHolding(
	groups map[string]*issuerGroup,
	base money.Currency,
	info InstrumentInfo,
	value money.Money,
	guarantee *domain.Guarantee,
) error {
	key := domain.IssuerKey(info.Issuer, info.IssuerScheme, info.IssuerID)

	g, ok := groups[key]
	if !ok {
		zero, err := money.New(0, base)
		if err != nil {
			return err
		}

		g = &issuerGroup{
			IssuerExposure: IssuerExposure{
				Key:            key,
				MarketValue:    zero,
				CoveredValue:   zero,
				SovereignValue: zero,
				SpecialValue:   zero,
				UncoveredValue: zero,
			},
			best: zero,
		}
		groups[key] = g
	}

	var err error
	if g.MarketValue, err = g.MarketValue.Add(value); err != nil {
		return err
	}

	switch {
	case guarantee == nil:
	case guarantee.Covered(info.Subtype):
		g.CoveredValue, err = g.CoveredValue.Add(value)
	case guarantee.Special(info.Subtype):
		if g.CoveredValue, err = g.CoveredValue.Add(value); err == nil {
			g.SpecialValue, err = g.SpecialValue.Add(value)
		}
	case guarantee.Sovereign(info.Subtype):
		g.SovereignValue, err = g.SovereignValue.Add(value)
	}

	if err != nil {
		return err
	}

	if g.Issuer == "" || value.Amount() > g.best.Amount() {
		g.Issuer, g.best = info.Issuer, value
	}

	return nil
}

func issuerRows(
	groups map[string]*issuerGroup,
	base money.Currency,
	guarantee *domain.Guarantee,
) ([]IssuerExposure, error) {
	rows := make([]IssuerExposure, 0, len(groups))

	for _, g := range groups {
		row := g.IssuerExposure

		var err error
		if row.UncoveredValue, err = row.MarketValue.Sub(row.CoveredValue); err != nil {
			return nil, err
		}

		if row.UncoveredValue, err = row.UncoveredValue.Sub(row.SovereignValue); err != nil {
			return nil, err
		}

		if guarantee != nil {
			limit, excess, err := issuerLimit(row, *guarantee)
			if err != nil {
				return nil, err
			}

			row.Limit, row.Excess = &limit, &excess
		}

		rows = append(rows, row)
	}

	slices.SortFunc(rows, func(a, b IssuerExposure) int {
		if (a.Key == "") != (b.Key == "") {
			return cmp.Compare(boolInt(a.Key == ""), boolInt(b.Key == ""))
		}

		return cmp.Or(
			cmp.Compare(b.MarketValue.Amount(), a.MarketValue.Amount()),
			cmp.Compare(a.Key, b.Key),
		)
	})

	return rows, nil
}

func exceedsPeriod(
	rows []IssuerExposure,
	base money.Currency,
	guarantee *domain.Guarantee,
) (bool, error) {
	if guarantee == nil {
		return false, nil
	}

	sum, err := money.New(0, base)
	if err != nil {
		return false, err
	}

	// The special guarantee stays outside the ceiling of the period.
	for _, r := range rows {
		if sum, err = sum.Add(r.CoveredValue); err != nil {
			return false, err
		}

		if sum, err = sum.Sub(r.SpecialValue); err != nil {
			return false, err
		}
	}

	return sum.Amount() > guarantee.LimitPerPeriod.Amount(), nil
}

// issuerLimit returns the limit that applies to an issuer, the ordinary one plus the special one
// when it holds a special security, and what passes each of them.
func issuerLimit(row IssuerExposure, g domain.Guarantee) (money.Money, money.Money, error) {
	ordinary, err := row.CoveredValue.Sub(row.SpecialValue)
	if err != nil {
		return money.Money{}, money.Money{}, err
	}

	excess, err := above(ordinary, g.LimitPerIssuer)
	if err != nil || row.SpecialValue.IsZero() {
		return g.LimitPerIssuer, excess, err
	}

	special, err := above(row.SpecialValue, g.SpecialLimit)
	if err != nil {
		return money.Money{}, money.Money{}, err
	}

	if excess, err = excess.Add(special); err != nil {
		return money.Money{}, money.Money{}, err
	}

	limit, err := g.LimitPerIssuer.Add(g.SpecialLimit)

	return limit, excess, err
}

// above returns what value passes limit, zero when it does not.
func above(value, limit money.Money) (money.Money, error) {
	excess, err := value.Sub(limit)
	if err != nil || !excess.IsNegative() {
		return excess, err
	}

	return money.New(0, value.Currency())
}

func boolInt(b bool) int {
	if b {
		return 1
	}

	return 0
}
