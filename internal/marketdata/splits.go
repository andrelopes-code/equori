package marketdata

import (
	"context"
	"errors"
	"fmt"
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

const (
	// splitSpanDays is how far from its date a split is confirmed by a price (A266 SA3).
	splitSpanDays = 15
	// ratioDecimals is the precision of a stored ratio.
	ratioDecimals = 12
)

// tickSplits reads, once a day, the splits the enabled sources state and stores those the closes
// confirm (A266 SA2, SA3).
func (m *Module) tickSplits(ctx context.Context) error {
	today := m.feeds.Clock.Today(ctx)
	if m.splitsChecked.Equal(today) {
		return nil
	}

	sources, err := m.enabledSources(ctx)
	if err != nil {
		return err
	}

	list, err := m.ListInstruments(ctx, "")
	if err != nil {
		return err
	}

	ins := feedInstruments(list)

	quotes := make(map[money.Currency]money.Currency, len(ins))
	for _, in := range ins {
		quotes[in.Code] = in.QuoteCurrency
	}

	var failed error

	for _, src := range sources {
		splits, ok := src.(feed.SplitSource)
		if !ok {
			continue
		}

		found, err := splits.Splits(ctx, ins)
		failed = errors.Join(failed, err)

		for _, s := range found {
			failed = errors.Join(failed, m.storeSplit(ctx, src.ID(), s, quotes[s.Instrument]))
		}
	}

	m.splitsChecked = today

	return failed
}

// storeSplit stores a split that the closes around its date confirm, on the date of the first one in
// new units.
func (m *Module) storeSplit(
	ctx context.Context,
	source string,
	s feed.Split,
	quote money.Currency,
) error {
	before, found, err := m.PriceOnOrBefore(ctx, s.Instrument, quote, s.Date.AddDate(0, 0, -1))
	if err != nil || !found || before.Date.Before(s.Date.AddDate(0, 0, -splitSpanDays)) {
		return err
	}

	rows, err := m.q.FirstPriceFrom(ctx, postgres.FirstPriceFromParams{
		Instrument:      string(s.Instrument),
		QuoteInstrument: string(quote),
		FromDate:        s.Date,
		ToDate:          s.Date.AddDate(0, 0, splitSpanDays),
	})
	if err != nil || len(rows) == 0 {
		return err
	}

	after, err := toPrice(rows[0])
	if err != nil || !domain.ConfirmsSplit(before.Value, after.Value, s.Ratio) {
		return err
	}

	var ratio pgtype.Numeric
	if err := ratio.Scan(s.Ratio.FloatString(ratioDecimals)); err != nil {
		return fmt.Errorf("ratio of the split of %s: %w", s.Instrument, err)
	}

	err = m.q.StoreSplit(ctx, postgres.StoreSplitParams{
		Instrument: string(s.Instrument),
		Date:       after.Date,
		Ratio:      ratio,
		Source:     source,
	})
	if err != nil {
		return fmt.Errorf("store the split of %s: %w", s.Instrument, err)
	}

	return nil
}

// splitsOf are the stored splits of one instrument.
func (m *Module) splitsOf(ctx context.Context, code money.Currency) ([]domain.Split, error) {
	rows, err := m.q.ListInstrumentSplits(ctx, string(code))
	if err != nil {
		return nil, fmt.Errorf("list the splits of %s: %w", code, err)
	}

	byCode, err := toSplits(rows)

	return byCode[code], err
}

// allSplits are the stored splits by instrument.
func (m *Module) allSplits(ctx context.Context) (map[money.Currency][]domain.Split, error) {
	rows, err := m.q.ListSplits(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the splits: %w", err)
	}

	return toSplits(rows)
}

func toSplits(rows []postgres.MarketdataSplit) (map[money.Currency][]domain.Split, error) {
	out := make(map[money.Currency][]domain.Split)

	for _, r := range rows {
		ratio, err := platformpg.RateOf(r.Ratio)
		if err != nil {
			return nil, fmt.Errorf("ratio of the split of %s: %w", r.Instrument, err)
		}

		exact, _ := new(big.Rat).SetString(ratio.String())
		code := money.Currency(r.Instrument)
		out[code] = append(out[code], domain.Split{Date: r.Date, Ratio: exact})
	}

	return out, nil
}

// adjusted replaces the references and the trend of q by their prices in the units of after every
// split (A266 SA5).
func adjusted(q domain.InstrumentQuote, splits []domain.Split) domain.InstrumentQuote {
	if len(splits) == 0 {
		return q
	}

	refs := []**domain.QuotePoint{
		&q.References.Week,
		&q.References.Month,
		&q.References.Quarter,
		&q.References.Year,
		&q.References.YearToDate,
	}
	for k := range q.Trend {
		refs = append(refs, &q.Trend[k])
	}

	for _, ref := range refs {
		if *ref == nil {
			continue
		}

		value, _ := domain.Adjusted((*ref).Value, (*ref).Date, splits)
		*ref = &domain.QuotePoint{Date: (*ref).Date, Value: value}
	}

	return q
}
