package marketdata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

// Terms are the contract of a fixed income security (investments design 4.2).
type Terms = domain.Terms

// Payment is a date on which a fixed income security pays interest, returns principal or both.
type Payment = domain.Payment

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
		return storeTerms(ctx, m.q.WithTx(tx), code, t)
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

	return m.termsWithPayments(ctx, row)
}

// BusinessDayIndexes are the indexes that compound by business day.
func (m *Module) BusinessDayIndexes() domain.BusinessDayIndexes { return m.businessDays }

// storeTerms writes the terms and the payments of code and drops the accrued prices, which the
// next tick computes again from the new terms.
func storeTerms(ctx context.Context, q *postgres.Queries, code string, t Terms) error {
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
		RateSteps:      rateStepsJSON(t.RateSteps),
		RateStepsApply: optional(t.RateStepsApply),
	}); err != nil {
		return fmt.Errorf("put terms: %w", err)
	}

	if err := putPayments(ctx, q, code, t.Payments); err != nil {
		return err
	}

	return q.DeletePricesBySource(
		ctx,
		postgres.DeletePricesBySourceParams{Source: sourceAccrual, Instrument: code},
	)
}

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

// termsWithPayments is the terms of row with the payments stored for its instrument.
func (m *Module) termsWithPayments(
	ctx context.Context, row postgres.MarketdataFixedIncomeTerm,
) (Terms, error) {
	payments, err := m.q.ListPayments(ctx, row.InstrumentCode)
	if err != nil {
		return Terms{}, fmt.Errorf("list payments: %w", err)
	}

	t := toTerms(row)
	var steps []storedStep
	if err := json.Unmarshal(row.RateSteps, &steps); err != nil {
		return Terms{}, fmt.Errorf("read rate steps of %s: %w", row.InstrumentCode, err)
	}

	for _, s := range steps {
		t.RateSteps = append(t.RateSteps, domain.RateStep(s))
	}

	for _, p := range payments {
		t.Payments = append(t.Payments, Payment{
			PaysOn:         p.PaysOn,
			AmortizationBP: int(p.AmortizationBp),
			PaysInterest:   p.PaysInterest,
		})
	}

	return t, nil
}

// putPayments replaces the payments of code with payments.
func putPayments(ctx context.Context, q *postgres.Queries, code string, payments []Payment) error {
	if err := q.DeletePayments(ctx, code); err != nil {
		return fmt.Errorf("delete payments: %w", err)
	}

	if len(payments) == 0 {
		return nil
	}

	params := postgres.InsertPaymentsParams{InstrumentCode: code}
	for _, p := range payments {
		params.PaysOn = append(params.PaysOn, p.PaysOn)
		//nolint:gosec // G115: Validate bounds it to 0..10000
		params.AmortizationBp = append(params.AmortizationBp, int32(p.AmortizationBP))
		params.PaysInterest = append(params.PaysInterest, p.PaysInterest)
	}

	if err := q.InsertPayments(ctx, params); err != nil {
		return fmt.Errorf("insert payments: %w", err)
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

	if r.RateStepsApply != nil {
		t.RateStepsApply = *r.RateStepsApply
	}

	return t
}

// storedStep is a rate step as the terms row holds it in rate_steps (progressive rate PR1).
type storedStep struct {
	AfterDays        int `json:"after_days"`
	PercentOfIndexBP int `json:"percent_of_index_bp"`
	SpreadBP         int `json:"spread_bp"`
}

// rateStepsJSON is the JSON array of steps; [] when there is none.
func rateStepsJSON(steps []domain.RateStep) []byte {
	out := make([]storedStep, len(steps))
	for i, s := range steps {
		out[i] = storedStep(s)
	}

	b, _ := json.Marshal(out) //nolint:errchkjson // a slice of int fields always marshals

	return b
}

// optionalDate is nil for the zero time.
func optionalDate(d time.Time) *time.Time {
	if d.IsZero() {
		return nil
	}

	return &d
}
