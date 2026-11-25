package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// contributionView values p at today (CN5) and, with split, divides p.Amount over it (CN7, CN8).
func (s *Service) contributionView(
	ctx context.Context,
	booksID int64,
	ab accountBook,
	p domain.Plan,
	base money.Currency,
	split bool,
) (ContributionView, error) {
	today := s.ledger.Today(ctx)

	balances, err := s.ledger.Balances(ctx, booksID, today)
	if err != nil {
		return ContributionView{}, err
	}

	guarantee, err := s.guaranteeIn(ctx, booksID, base)
	if err != nil {
		return ContributionView{}, err
	}

	s.warm(ctx, today, contributionCodes(balances, p, base))

	v := valuer{
		s:         s,
		ab:        ab,
		held:      heldBalances(balances),
		base:      base,
		today:     today,
		prices:    new([]Price),
		guarantee: guarantee,
		facts:     map[money.Currency]domain.SecurityFacts{},
	}

	val, err := v.valuate(ctx, p)
	if err != nil {
		return ContributionView{}, err
	}

	view, err := assemble(p, val, base, split, today)
	if err != nil {
		return ContributionView{}, err
	}

	view.Current = currentQuotes(distinctPrices(*v.prices))
	if guarantee != nil {
		view.GuaranteeName = guarantee.Name
	}

	return view, nil
}

func heldBalances(balances []AccountBalance) map[uuid.UUID]money.Money {
	held := map[uuid.UUID]money.Money{}

	for _, b := range balances {
		if !b.Amount.IsZero() {
			held[b.AccountID] = b.Amount
		}
	}

	return held
}

// contributionCodes are the instruments the view values: each held balance, each instrument
// member of p and base.
func contributionCodes(
	balances []AccountBalance,
	p domain.Plan,
	base money.Currency,
) []money.Currency {
	codes := []money.Currency{base}

	for _, b := range balances {
		if !b.Amount.IsZero() {
			codes = append(codes, b.Amount.Currency())
		}
	}

	for _, c := range p.Classes {
		for _, m := range c.Members {
			if m.Instrument != "" {
				codes = append(codes, m.Instrument)
			}
		}
	}

	return codes
}

// valuation is the value of every member of a plan in the base currency.
type valuation struct {
	values  [][]money.Money
	units   [][]*money.Money
	scales  [][]int
	matched [][]ContributionMatched // one slice per class: the securities its rules take (GR5)
	outside []ContributionOutside
	missing []ContributionMissing
}

type memberValue struct {
	value   money.Money
	unit    *money.Money
	scale   int
	missing *ContributionMissing
}

// valuer converts one account at a time, so a missing price affects only its member (CN10).
type valuer struct {
	s     *Service
	ab    accountBook
	held  map[uuid.UUID]money.Money
	base  money.Currency
	today time.Time

	// prices collects the prices of every conversion of the view (A248 CQ24).
	prices *[]Price

	guarantee *domain.Guarantee // nil without a guarantee in the base currency (GR4)
	facts     map[money.Currency]domain.SecurityFacts
}

func (v valuer) valuate(ctx context.Context, p domain.Plan) (valuation, error) {
	val := valuation{matched: make([][]ContributionMatched, len(p.Classes))}

	for _, c := range p.Classes {
		if err := v.classMembers(ctx, c, &val); err != nil {
			return valuation{}, err
		}
	}

	assigned, err := v.assign(ctx, p)
	if err != nil {
		return valuation{}, err
	}

	if err := v.matched(ctx, assigned, &val); err != nil {
		return valuation{}, err
	}

	if val.outside, err = v.outside(ctx, p, assigned); err != nil {
		return valuation{}, err
	}

	return val, nil
}

// classMembers values the members of c and appends them to val.
func (v valuer) classMembers(ctx context.Context, c domain.PlanClass, val *valuation) error {
	values := make([]money.Money, len(c.Members))
	units := make([]*money.Money, len(c.Members))
	scales := make([]int, len(c.Members))

	for j, m := range c.Members {
		mv, err := v.member(ctx, m)
		if err != nil {
			return err
		}

		values[j], units[j], scales[j] = mv.value, mv.unit, mv.scale
		if mv.missing != nil {
			val.missing = append(val.missing, *mv.missing)
		}
	}

	val.values, val.units = append(val.values, values), append(val.units, units)
	val.scales = append(val.scales, scales)

	return nil
}

func (v valuer) member(ctx context.Context, m domain.PlanMember) (memberValue, error) {
	zero, err := money.New(0, v.base)
	if err != nil {
		return memberValue{}, err
	}

	if m.AccountID != uuid.Nil {
		a := v.ab.byID[m.AccountID]

		return v.sum(
			ctx,
			[]Account{a},
			zero,
			ContributionMissing{AccountID: a.ID, Instrument: a.Instrument},
		)
	}

	mv, err := v.instrumentValue(ctx, m.Instrument)
	if err != nil {
		return memberValue{}, err
	}

	mv.unit, mv.scale, err = v.unitValue(ctx, m.Instrument)

	return mv, err
}

// sum values the balances of accounts; the first missing price or rate returns lack as missing.
func (v valuer) sum(
	ctx context.Context,
	accounts []Account,
	zero money.Money,
	lack ContributionMissing,
) (memberValue, error) {
	total := zero

	for _, a := range accounts {
		bal, ok := v.held[a.ID]
		if !ok {
			continue
		}

		value, missing, err := v.toBase(ctx, bal)
		if err != nil {
			return memberValue{}, err
		}

		if missing {
			lack.Kind = v.s.missingKind(ctx, v.ab, lack.Instrument)

			return memberValue{value: zero, missing: &lack}, nil
		}

		if total, err = total.Add(value); err != nil {
			return memberValue{}, fmt.Errorf("sum the member: %w", err)
		}
	}

	return memberValue{value: total}, nil
}

// unitValue is the price of one whole unit of code in the base currency (CN16), nil without one,
// and the scale of code.
func (v valuer) unitValue(
	ctx context.Context,
	code money.Currency,
) (*money.Money, int, error) {
	scale, err := v.s.md.Scale(ctx, code)
	if err != nil {
		return nil, 0, err
	}

	units := int64(1)
	for range scale {
		units *= 10
	}

	q, err := money.NewOf(units, code, scale)
	if err != nil {
		return nil, 0, err
	}

	value, missing, err := v.toBase(ctx, q)
	if err != nil || missing {
		return nil, scale, err
	}

	return &value, scale, nil
}

// toBase converts q to the base currency; missing is true when no price path exists.
func (v valuer) toBase(
	ctx context.Context,
	q money.Money,
) (value money.Money, missing bool, err error) {
	if q.Currency() == v.base {
		return q, false, nil
	}

	value, prices, err := v.s.value(ctx, q, v.base, v.today)
	*v.prices = append(*v.prices, prices...)

	if errors.Is(err, ErrPriceMissing) {
		return money.Money{}, true, nil
	}

	return value, false, err
}

// outside lists the accounts and holdings that match no member (CN6); a holding is summed by
// instrument.
func (v valuer) outside(
	ctx context.Context,
	p domain.Plan,
	assigned map[money.Currency]int,
) ([]ContributionOutside, error) {
	accountIn, instrumentIn := map[uuid.UUID]bool{}, map[money.Currency]bool{}
	for _, c := range p.Classes {
		for _, m := range c.Members {
			accountIn[m.AccountID], instrumentIn[m.Instrument] = true, true
		}
	}

	for code := range assigned {
		instrumentIn[code] = true
	}

	var out []ContributionOutside

	holdings := map[money.Currency]*money.Money{}

	for _, a := range v.ab.accounts {
		bal, ok := v.held[a.ID]
		if !ok || a.Class != classAsset || accountIn[a.ID] || instrumentIn[a.Instrument] {
			continue
		}

		entry, ok, err := v.outsideEntry(ctx, a, bal)
		if err != nil {
			return nil, err
		}

		switch {
		case !ok:
		case entry.Instrument == "":
			out = append(out, entry)
		default:
			prev, found := holdings[entry.Instrument]
			if holdings[entry.Instrument], err = mergeValue(prev, entry.Value, found); err != nil {
				return nil, fmt.Errorf("sum the holdings: %w", err)
			}
		}
	}

	entries, err := v.holdingEntries(ctx, holdings)

	return append(out, entries...), err
}

// mergeValue adds b to the sum a of earlier holding accounts (found); a holding account without a
// value leaves the sum without one.
func mergeValue(a, b *money.Money, found bool) (*money.Money, error) {
	if !found {
		return b, nil
	}

	if a == nil || b == nil {
		return nil, nil
	}

	sum, err := a.Add(*b)

	return &sum, err
}

// outsideEntry values an account outside the plan: an eligible account (CN3) or a holding by
// instrument. ok is false for any other account. A value without a price path is nil and does
// not make the plan incomplete: the account is not a member (CN10).
func (v valuer) outsideEntry(
	ctx context.Context,
	a Account,
	bal money.Money,
) (entry ContributionOutside, ok bool, err error) {
	converted, missing, err := v.toBase(ctx, bal)
	if err != nil {
		return ContributionOutside{}, false, err
	}

	var value *money.Money
	if !missing {
		value = &converted
	}

	t, err := v.s.instrumentType(ctx, v.ab, a.Instrument)
	if err != nil {
		return ContributionOutside{}, false, err
	}

	if t != typeCurrency {
		return ContributionOutside{Instrument: a.Instrument, Value: value}, true, nil
	}

	eligible, err := v.s.eligibleAccount(ctx, v.ab, a)

	return ContributionOutside{AccountID: a.ID, Value: value}, eligible, err
}
