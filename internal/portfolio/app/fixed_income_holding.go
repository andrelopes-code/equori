package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const fullPrincipalBP = 10000

// holdingEvents are the events of one holding dated up to to. The events before the range stay
// in the list: their unrecorded amortizations lower the units of the later ones.
func (s *Service) holdingEvents(
	ctx context.Context,
	booksID int64,
	h holding,
	to, today time.Time,
	positions *positionCache,
) ([]FixedIncomeEvent, error) {
	maturity, found, err := s.md.Maturity(ctx, h.instrument)
	if err != nil || !found {
		return nil, err
	}

	coupons, err := s.md.Coupons(ctx, h.instrument)
	if err != nil {
		return nil, err
	}

	b, err := s.newEventBuilder(ctx, booksID, h, maturity, to, coupons)
	if err != nil {
		return nil, err
	}

	b.today, b.positions = today, positions
	b.receiptFee = func(amount money.Money, date time.Time) (*money.Money, error) {
		return s.ledger.ReceiptCustodyFee(ctx, booksID, h.instrument, amount, date)
	}

	atMaturity := false

	for _, c := range coupons {
		atMaturity = atMaturity || c.PaysOn.Equal(maturity)
		if c.Date.After(to) {
			break
		}

		if err := b.coupon(ctx, c); err != nil {
			return nil, err
		}
	}

	if !atMaturity && !maturity.After(to) {
		err = b.bullet(ctx)
	}

	return b.out, err
}

func (s *Service) newEventBuilder(
	ctx context.Context,
	booksID int64,
	h holding,
	maturity, to time.Time,
	coupons []Coupon,
) (*eventBuilder, error) {
	info, err := s.md.InstrumentOf(ctx, h.instrument)
	if err != nil {
		return nil, err
	}

	b := &eventBuilder{
		md: s.md, h: h, quote: info.QuoteCurrency, maturity: maturity,
		residualBP: fullPrincipalBP,
	}
	if b.scale, err = s.md.Scale(ctx, h.instrument); err != nil {
		return nil, err
	}

	if b.quoteScale, err = s.md.Scale(ctx, b.quote); err != nil {
		return nil, err
	}

	first := maturity
	if len(coupons) > 0 && coupons[0].Date.Before(first) {
		first = coupons[0].Date
	}

	lo := first.AddDate(0, 0, -domain.RecordWindowDays-1)
	hi := to.AddDate(0, 0, domain.RecordWindowDays+1)

	if b.incomes, err = s.repo.IncomeEvents(ctx, booksID, lo, hi); err != nil {
		return nil, err
	}

	b.sales, err = s.repo.RealizedResults(ctx, booksID, lo, hi)

	return b, err
}

// eventBuilder walks the payments of one holding in date order.
type eventBuilder struct {
	md         MarketData
	h          holding
	quote      money.Currency
	maturity   time.Time
	scale      int
	quoteScale int
	today      time.Time
	positions  *positionCache
	incomes    []domain.IncomeEvent
	sales      []domain.RealizedResult

	// released are the units of the amortizations not recorded yet; residualBP is the principal
	// left, in basis points, before the next payment.
	released   int64
	residualBP int
	out        []FixedIncomeEvent

	// receiptFee is the custody fee of a payment of amount on date, nil when it pays none.
	receiptFee func(amount money.Money, date time.Time) (*money.Money, error)
}

func (b *eventBuilder) coupon(ctx context.Context, c Coupon) error {
	defer func() { b.residualBP -= c.AmortizationBP }()

	units, err := b.units(ctx, c.Date)
	if err != nil || units <= 0 {
		return err
	}

	if c.PaysInterest {
		if _, err := b.add(
			ctx,
			domain.EventInterest,
			c.Date,
			units,
			c.Interest,
			c.RateMissing,
		); err != nil {
			return err
		}
	}

	if c.PaysOn.Equal(b.maturity) {
		_, err := b.add(ctx, domain.EventMaturity, c.Date, units, c.Principal, c.RateMissing)

		return err
	}

	if c.AmortizationBP <= 0 && c.AmortizeOneOf <= 0 {
		return nil
	}

	amortized := domain.AmortizedUnits(units, c.AmortizationBP, b.residualBP)
	if c.AmortizeOneOf > 0 {
		amortized = domain.AmortizedUnits(units, 1, c.AmortizeOneOf)
	}

	recorded, err := b.add(
		ctx, domain.EventAmortization, c.Date, amortized, c.Principal, c.RateMissing,
	)
	if !recorded {
		b.released += amortized
	}

	return err
}

// bullet is the maturity of a contract with no payment on its maturity date: the units valued at
// the price of that date.
func (b *eventBuilder) bullet(ctx context.Context) error {
	units, err := b.units(ctx, b.maturity)
	if err != nil || units <= 0 {
		return err
	}

	q, err := money.NewOf(units, b.h.instrument, b.scale)
	if err != nil {
		return err
	}

	value, _, err := b.md.Convert(ctx, q, b.quote, b.maturity)
	if err != nil && !errors.Is(err, ErrPriceMissing) {
		return err
	}

	e := FixedIncomeEvent{
		AccountID: b.h.account, Instrument: b.h.instrument, Date: b.maturity,
		Kind: domain.EventMaturity, Quantity: q, RateMissing: err != nil,
	}
	if err == nil {
		e.Gross = &value
	}

	b.finish(e)

	return nil
}

// units are the units held the day before date, less the amortizations not recorded yet.
func (b *eventBuilder) units(ctx context.Context, date time.Time) (int64, error) {
	held, err := b.positions.held(ctx, b.h, date.AddDate(0, 0, -1))

	return held - b.released, err
}

// add appends the event of units paying perUnit each and reports whether it is recorded.
func (b *eventBuilder) add(
	ctx context.Context,
	kind string,
	date time.Time,
	units int64,
	perUnit string,
	missing bool,
) (bool, error) {
	q, err := money.NewOf(units, b.h.instrument, b.scale)
	if err != nil {
		return false, err
	}

	e := FixedIncomeEvent{
		AccountID: b.h.account, Instrument: b.h.instrument, Date: date, Kind: kind,
		Quantity: q, RateMissing: missing,
	}

	if !missing {
		minor, err := domain.GrossOf(perUnit, units, b.scale, b.quoteScale)
		if err != nil {
			return false, err
		}

		gross, err := money.New(minor, b.quote)
		if err != nil {
			return false, err
		}

		e.Gross = &gross

		if kind == domain.EventAmortization && b.receiptFee != nil {
			if e.CustodyFee, err = b.receiptFee(gross, date); err != nil {
				return false, err
			}
		}
	}

	return b.finish(e), nil
}

// finish sets the state of e, appends it and reports whether it is recorded.
func (b *eventBuilder) finish(e FixedIncomeEvent) bool {
	recorded := domain.EventRecorded(
		e.Kind, e.AccountID, e.Date, e.Quantity.Amount(), b.incomes, b.sales,
	)
	e.State = domain.EventState(e.Date, b.today, recorded)
	b.out = append(b.out, e)

	return recorded
}
