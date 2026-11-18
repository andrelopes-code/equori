package toolapi

import (
	"context"
	"fmt"
	"slices"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// maxPayments is the maxItems of payments in putInstrumentTerms.
const maxPayments = 400

type paymentIn struct {
	PaysOn         tool.Date `json:"pays_on"         jsonschema:"date"`
	AmortizationBP int       `json:"amortization_bp" jsonschema:"basis points of the principal at issue; 0 for interest only"`
	PaysInterest   bool      `json:"pays_interest"   jsonschema:"pays the accrued interest"`
}

type setPaymentScheduleIn struct {
	Code     string      `json:"code"     jsonschema:"code of a fixed income instrument with terms"`
	Payments []paymentIn `json:"payments" jsonschema:"every date of interest or principal; at most 400"`
}

type setPaymentScheduleOut struct {
	Terms termsView `json:"terms"`
}

// setPaymentSchedule writes the payments field of putInstrumentTerms, which manage_instrument
// set_terms leaves out for its size (coverage row F-16).
func setPaymentSchedule(svc Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "set_payment_schedule",
		Description: "Proposes replacing the interest and principal dates of a fixed income instrument with the " +
			"issuer's schedule; the other terms stay. Use it for irregular dates, such as the amortization of a CRI. " +
			"Do not use it for a regular period: set_terms takes interest_every_months. The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, _ int64, in setPaymentScheduleIn) (tool.Preview, error) {
		old, t, err := scheduledTerms(ctx, svc, in)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{Action: "set_payment_schedule", Changes: []tool.Change{{
			Field:  "terms",
			Before: tool.TextValue(scheduleText(old.Payments)),
			After:  tool.TextValue(scheduleText(t.Payments)),
		}}}, nil
	}, func(ctx context.Context, _ int64, in setPaymentScheduleIn) (setPaymentScheduleOut, error) {
		_, t, err := scheduledTerms(ctx, svc, in)
		if err != nil {
			return setPaymentScheduleOut{}, err
		}

		inst, err := svc.Instrument(ctx, in.Code)
		if err != nil {
			return setPaymentScheduleOut{}, err
		}

		t, err = svc.PutTerms(ctx, in.Code, t)
		if err != nil {
			return setPaymentScheduleOut{}, err
		}

		v, err := toTermsView(t, inst.QuoteCurrency)

		return setPaymentScheduleOut{Terms: v}, err
	})
}

// scheduledTerms reads the stored terms of the instrument and returns them with the payments of
// the call in place of theirs, sorted by date.
func scheduledTerms(
	ctx context.Context,
	svc Service,
	in setPaymentScheduleIn,
) (domain.Terms, domain.Terms, error) {
	switch {
	case len(in.Payments) == 0:
		return domain.Terms{}, domain.Terms{}, tool.InvalidArgument("payments", "is required")
	case len(in.Payments) > maxPayments:
		return domain.Terms{}, domain.Terms{}, tool.InvalidArgument(
			"payments",
			"holds at most 400 dates",
		)
	}

	old, err := svc.Terms(ctx, in.Code)
	if err != nil {
		return domain.Terms{}, domain.Terms{}, err
	}

	t := old
	t.Payments = make([]domain.Payment, len(in.Payments))

	for i, p := range in.Payments {
		t.Payments[i] = domain.Payment{
			PaysOn:         p.PaysOn.Time,
			AmortizationBP: p.AmortizationBP,
			PaysInterest:   p.PaysInterest,
		}
	}

	slices.SortFunc(t.Payments, func(a, b domain.Payment) int { return a.PaysOn.Compare(b.PaysOn) })

	return old, t, nil
}

// scheduleText describes a schedule by its count, its first and last dates and the amortization
// it repays.
func scheduleText(payments []domain.Payment) string {
	if len(payments) == 0 {
		return "no payments before maturity"
	}

	total := 0
	for _, p := range payments {
		total += p.AmortizationBP
	}

	return fmt.Sprintf(
		"%d payments from %s to %s, amortization %d.%02d%%",
		len(payments),
		payments[0].PaysOn.Format("2006-01-02"),
		payments[len(payments)-1].PaysOn.Format("2006-01-02"),
		total/100,
		total%100,
	)
}
