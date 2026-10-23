package marketdata

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
)

// Terms are the contract of a fixed income security (investments design 4.2).
type Terms = domain.Terms

const typeFixedIncome = "fixed_income"

// PutTerms stores the terms of a fixed income instrument, replacing any earlier ones.
func (m *Module) PutTerms(ctx context.Context, code string, t Terms) (Terms, error) {
	if err := t.Validate(); err != nil {
		return Terms{}, err
	}
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return Terms{}, err
	}
	if in.Type != typeFixedIncome {
		return Terms{}, &domain.FieldError{Field: "code", Message: "terms belong to a fixed_income instrument"}
	}
	err = pgx.BeginFunc(ctx, m.pool, func(tx pgx.Tx) error {
		q := m.q.WithTx(tx)
		if err := q.PutTerms(ctx, postgres.PutTermsParams{
			InstrumentCode: code, IssuedOn: t.IssuedOn, MaturesOn: t.MaturesOn, IndexID: optional(t.IndexID),
			PercentOfIndexBp: int32(t.PercentOfIndexBP), SpreadBp: int32(t.SpreadBP), DayCount: t.DayCount, FaceValue: t.FaceValue, //nolint:gosec // G115: the contract bounds both to int32
		}); err != nil {
			return fmt.Errorf("put terms: %w", err)
		}
		// The accrued prices follow the terms: the next tick computes them again.
		return q.DeletePricesBySource(ctx, postgres.DeletePricesBySourceParams{Source: sourceAccrual, Instrument: code})
	})
	return t, err
}

// Terms returns the terms of an instrument; ErrUnknownInstrument when it has none.
func (m *Module) Terms(ctx context.Context, code string) (Terms, error) {
	row, err := m.q.GetTerms(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return Terms{}, ErrNoTerms
	}
	if err != nil {
		return Terms{}, err
	}
	return toTerms(row), nil
}

func toTerms(r postgres.MarketdataFixedIncomeTerm) Terms {
	t := Terms{
		IssuedOn: r.IssuedOn, MaturesOn: r.MaturesOn, PercentOfIndexBP: int(r.PercentOfIndexBp), SpreadBP: int(r.SpreadBp),
		DayCount: r.DayCount, FaceValue: r.FaceValue,
	}
	if r.IndexID != nil {
		t.IndexID = *r.IndexID
	}
	return t
}
