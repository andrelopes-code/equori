package marketdata

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

// Terms are the contract of a fixed income security (investments design 4.2).
type Terms = domain.Terms

const typeFixedIncome = "fixed_income"

// PutTerms stores the terms of a fixed income instrument, replacing any earlier ones.
func (m *Module) PutTerms(ctx context.Context, code string, t Terms) (Terms, error) {
	if err := t.Validate(m.businessDays); err != nil {
		return Terms{}, err
	}

	if err := m.checkCalendar(t.CalendarID); err != nil {
		return Terms{}, err
	}

	in, err := m.Instrument(ctx, code)
	if err != nil {
		return Terms{}, err
	}

	if in.Type != typeFixedIncome {
		return Terms{}, &domain.FieldError{
			Field:   "code",
			Message: "terms belong to a fixed_income instrument",
		}
	}

	err = pgx.BeginFunc(ctx, m.pool, func(tx pgx.Tx) error {
		q := m.q.WithTx(tx)
		//nolint:gosec // G115: the contract bounds both to int32
		if err := q.PutTerms(ctx, postgres.PutTermsParams{
			InstrumentCode: code,
			IssuedOn:       t.IssuedOn,
			MaturesOn:      t.MaturesOn,
			IndexID:        optional(t.IndexID),
			PercentOfIndexBp: int32(
				t.PercentOfIndexBP,
			),
			SpreadBp:       int32(t.SpreadBP),
			DayCount:       t.DayCount,
			FaceValue:      t.FaceValue,
			CalendarID:     optional(t.CalendarID),
			DailyLiquidity: t.DailyLiquidity,
			RedeemableFrom: optionalDate(t.RedeemableFrom),
		}); err != nil {
			return fmt.Errorf("put terms: %w", err)
		}

		// The accrued prices follow the terms: the next tick computes them again.
		return q.DeletePricesBySource(
			ctx,
			postgres.DeletePricesBySourceParams{Source: sourceAccrual, Instrument: code},
		)
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

// BusinessDayIndexes are the indexes that compound by business day.
func (m *Module) BusinessDayIndexes() domain.BusinessDayIndexes { return m.businessDays }

// checkCalendar refuses a calendar name that is not registered; an empty name is valid.
func (m *Module) checkCalendar(name string) error {
	if name == "" {
		return nil
	}

	if _, err := m.calendar(name); err != nil {
		return &domain.FieldError{Field: "calendar_id", Message: "is not a registered calendar"}
	}

	return nil
}

func toTerms(r postgres.MarketdataFixedIncomeTerm) Terms {
	t := Terms{
		IssuedOn:         r.IssuedOn,
		MaturesOn:        r.MaturesOn,
		PercentOfIndexBP: int(r.PercentOfIndexBp),
		SpreadBP:         int(r.SpreadBp),
		DayCount:         r.DayCount,
		FaceValue:        r.FaceValue,
		DailyLiquidity:   r.DailyLiquidity,
	}
	if r.IndexID != nil {
		t.IndexID = *r.IndexID
	}

	if r.CalendarID != nil {
		t.CalendarID = *r.CalendarID
	}

	if r.RedeemableFrom != nil {
		t.RedeemableFrom = *r.RedeemableFrom
	}

	return t
}

// optionalDate is nil for the zero time.
func optionalDate(d time.Time) *time.Time {
	if d.IsZero() {
		return nil
	}

	return &d
}
