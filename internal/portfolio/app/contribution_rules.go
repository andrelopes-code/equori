package app

import (
	"cmp"
	"context"
	"errors"
	"maps"
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// validateRules applies the checks of GR2 that depend on the catalog and the jurisdiction: a quote
// currency names a currency of the catalog, and a guarantee condition needs a guarantee in the
// base currency.
func (s *Service) validateRules(
	ctx context.Context,
	ab accountBook,
	p domain.Plan,
	base money.Currency,
) error {
	guarantee, err := s.guaranteeIn(ctx, ab.booksID, base)
	if err != nil {
		return err
	}

	for _, c := range p.Classes {
		for _, r := range c.Rules {
			if err := s.validateRule(ctx, ab, r, guarantee); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Service) validateRule(
	ctx context.Context,
	ab accountBook,
	r domain.PlanRule,
	guarantee *domain.Guarantee,
) error {
	if r.Guarantee != "" && guarantee == nil {
		return ErrContributionRuleInvalid
	}

	if r.QuoteCurrency == "" {
		return nil
	}

	t, err := s.instrumentType(ctx, ab, r.QuoteCurrency)
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && t != typeCurrency) {
		return ErrContributionRuleInvalid
	}

	return err
}

// assign gives each held security that a rule class takes its class (GR5); nil without a rule
// class. A security that an instrument member names stays with its member.
func (v valuer) assign(ctx context.Context, p domain.Plan) (map[money.Currency]int, error) {
	if !slices.ContainsFunc(p.Classes, domain.PlanClass.HasRules) {
		return nil, nil
	}

	codes, err := v.heldSecurities(ctx)
	if err != nil {
		return nil, err
	}

	assigned := map[money.Currency]int{}

	for _, code := range codes {
		facts, err := v.factsOf(ctx, code)
		if err != nil {
			return nil, err
		}

		if i, ok := p.ClassOf(code, facts, v.guarantee); ok && p.Classes[i].HasRules() {
			assigned[code] = i
		}
	}

	return assigned, nil
}

// matched values the securities of each rule class, by value descending then code (GR8), and
// lists the ones without a price or a rate as missing (GR6).
func (v valuer) matched(
	ctx context.Context,
	assigned map[money.Currency]int,
	val *valuation,
) error {
	for _, code := range slices.Sorted(maps.Keys(assigned)) {
		mv, err := v.instrumentValue(ctx, code)
		if err != nil {
			return err
		}

		i := assigned[code]
		val.matched[i] = append(
			val.matched[i],
			ContributionMatched{Instrument: code, Value: mv.value},
		)

		if mv.missing != nil {
			val.missing = append(val.missing, *mv.missing)
		}
	}

	for _, m := range val.matched {
		slices.SortStableFunc(m, func(a, b ContributionMatched) int {
			return cmp.Or(
				cmp.Compare(b.Value.Amount(), a.Value.Amount()),
				cmp.Compare(a.Instrument, b.Instrument),
			)
		})
	}

	return nil
}

// instrumentValue sums the holding accounts of code (CN5).
func (v valuer) instrumentValue(ctx context.Context, code money.Currency) (memberValue, error) {
	zero, err := money.New(0, v.base)
	if err != nil {
		return memberValue{}, err
	}

	var holdings []Account

	for _, a := range v.ab.accounts {
		if a.Instrument == code && a.Class == classAsset {
			holdings = append(holdings, a)
		}
	}

	return v.sum(ctx, holdings, zero, ContributionMissing{Instrument: code})
}

// heldSecurities lists the securities with a balance in an asset account, sorted by code.
func (v valuer) heldSecurities(ctx context.Context) ([]money.Currency, error) {
	seen := map[money.Currency]bool{}

	for _, a := range v.ab.accounts {
		if _, held := v.held[a.ID]; !held || a.Class != classAsset || seen[a.Instrument] {
			continue
		}

		t, err := v.s.instrumentType(ctx, v.ab, a.Instrument)
		if err != nil {
			return nil, err
		}

		seen[a.Instrument] = t != typeCurrency
	}

	var codes []money.Currency

	for code, security := range seen {
		if security {
			codes = append(codes, code)
		}
	}

	slices.Sort(codes)

	return codes, nil
}

// factsOf returns the facts of a security that a rule reads (GR2 to GR4), read once per view.
func (v valuer) factsOf(ctx context.Context, code money.Currency) (domain.SecurityFacts, error) {
	if facts, ok := v.facts[code]; ok {
		return facts, nil
	}

	info, err := v.s.md.InstrumentOf(ctx, code)
	if err != nil {
		return domain.SecurityFacts{}, err
	}

	facts := domain.SecurityFacts{
		Type:          info.Type,
		Subtype:       info.Subtype,
		QuoteCurrency: info.QuoteCurrency,
	}

	if info.Type == typeFixedIncome {
		c, ok, err := v.s.md.ContractFacts(ctx, code)
		if err != nil {
			return domain.SecurityFacts{}, err
		}

		facts.Contract = ok
		facts.ReturnKind, facts.MaturesOn = c.ReturnKind, c.MaturesOn
		facts.DailyLiquidity, facts.Sovereign = c.DailyLiquidity, c.Sovereign
	}

	v.facts[code] = facts

	return facts, nil
}

// holdingEntries lists the holdings outside the plan by instrument with their return kind (GR8).
func (v valuer) holdingEntries(
	ctx context.Context,
	holdings map[money.Currency]*money.Money,
) ([]ContributionOutside, error) {
	var out []ContributionOutside

	for _, code := range slices.Sorted(maps.Keys(holdings)) {
		facts, err := v.factsOf(ctx, code)
		if err != nil {
			return nil, err
		}

		out = append(out, ContributionOutside{
			Instrument: code,
			Value:      holdings[code],
			ReturnKind: facts.ReturnKind,
		})
	}

	return out, nil
}
