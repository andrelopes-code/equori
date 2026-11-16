package marketdata

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	contractScale     = 6
	contractFieldRoot = "contract."
	defaultPercentBP  = 10000
)

// Contract is a fixed income application's security (A236 FC11, FC12). Code is set by
// CheckContract.
type Contract struct {
	Code                       money.Currency
	Currency                   money.Currency // the brokerage currency
	Subtype, Name              string
	IssuerName, IssuerScheme   string
	IssuerID                   string
	IssuedOn, MaturesOn        time.Time
	IndexID                    string
	PercentOfIndexBP, SpreadBP int
	DayCount, CalendarID       string
	DailyLiquidity             bool
	RedeemableFrom             time.Time
	Region                     string // the book's region, for the defaults
}

// CheckContract validates c for the application and returns it with the defaults of A236 FC12.
// A field error carries the prefix "contract.".
func (m *Module) CheckContract(
	ctx context.Context, booksID int64, c Contract, applicationID uuid.UUID,
) (Contract, error) {
	c = m.withContractDefaults(c, applicationID)

	in, terms, err := m.contractParts(ctx, c)
	if err != nil {
		return Contract{}, err
	}

	if _, err := in.Validate(); err != nil {
		return Contract{}, prefixField(err)
	}

	if err := terms.Validate(m.businessDays); err != nil {
		return Contract{}, prefixField(err)
	}

	if err := m.checkCalendar(terms.CalendarID); err != nil {
		return Contract{}, prefixField(err)
	}

	return c, nil
}

// DefineContract stores the instrument and the terms of a checked contract. PutTerms opens its
// own transaction, so a refusal of the terms deletes the instrument again.
func (m *Module) DefineContract(ctx context.Context, booksID int64, c Contract) error {
	in, terms, err := m.contractParts(ctx, c)
	if err != nil {
		return err
	}

	if _, err := m.DefineOwnInstrument(ctx, booksID, in); err != nil {
		return err
	}

	if _, err := m.PutTerms(ctx, string(c.Code), terms); err != nil {
		return errors.Join(err, m.DiscardContract(ctx, booksID, c.Code))
	}

	return nil
}

// DiscardContract deletes the instrument of booksID; a contract that an account uses stays and
// the call returns nil.
func (m *Module) DiscardContract(ctx context.Context, booksID int64, code money.Currency) error {
	in, err := m.Instrument(ctx, string(code))
	if err != nil {
		return err
	}

	if in.BooksID != booksID {
		return ErrUnknownInstrument
	}

	err = m.DeleteInstrument(ctx, string(code))
	if errors.Is(err, ErrInstrumentInUse) {
		return nil
	}

	return err
}

func (m *Module) withContractDefaults(c Contract, applicationID uuid.UUID) Contract {
	c.Code = domain.OwnCode(c.MaturesOn, applicationID)

	if c.IndexID != "" && c.PercentOfIndexBP == 0 {
		c.PercentOfIndexBP = defaultPercentBP
	}

	daily := m.businessDays.Has(c.IndexID)
	calendar := m.DefaultCalendar(c.Region)

	if c.DayCount == "" {
		c.DayCount = domain.DayCountAct365
		if daily || calendar != neutralCalendar {
			c.DayCount = domain.DayCountBus252
		}
	}

	if c.CalendarID == "" && c.DayCount == domain.DayCountBus252 && !daily {
		c.CalendarID = calendar
	}

	if strings.TrimSpace(c.Name) == "" {
		c.Name = contractName(c)
	}

	return c
}

// contractParts builds the instrument and the terms of c; the face value is one unit of the
// quote currency.
func (m *Module) contractParts(ctx context.Context, c Contract) (Instrument, Terms, error) {
	quote, err := m.Instrument(ctx, string(c.Currency))
	if err != nil || quote.Type != domain.TypeCurrency {
		return Instrument{}, Terms{}, &domain.FieldError{
			Field:   contractFieldRoot + "currency",
			Message: "must be a currency",
		}
	}

	in := Instrument{
		Code:          c.Code,
		Type:          domain.TypeFixedIncome,
		Scale:         contractScale,
		Name:          c.Name,
		QuoteCurrency: c.Currency,
		Subtype:       c.Subtype,
		Issuer:        domain.Issuer{Name: c.IssuerName, Scheme: c.IssuerScheme, ID: c.IssuerID},
	}

	terms := Terms{
		IssuedOn:         c.IssuedOn,
		MaturesOn:        c.MaturesOn,
		IndexID:          c.IndexID,
		PercentOfIndexBP: c.PercentOfIndexBP,
		SpreadBP:         c.SpreadBP,
		DayCount:         c.DayCount,
		FaceValue:        pow10(quote.Scale),
		CalendarID:       c.CalendarID,
		DailyLiquidity:   c.DailyLiquidity,
		RedeemableFrom:   c.RedeemableFrom,
	}

	return in, terms, nil
}

func contractName(c Contract) string {
	parts := []string{strings.ToUpper(c.Subtype), c.IssuerName, c.MaturesOn.Format(time.DateOnly)}

	return strings.Join(slices.DeleteFunc(parts, func(p string) bool { return p == "" }), " ")
}

func pow10(n int) int64 {
	v := int64(1)
	for range n {
		v *= 10
	}

	return v
}

// prefixField puts the prefix "contract." before the field of a validation error.
func prefixField(err error) error {
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		return &domain.FieldError{Field: contractFieldRoot + fe.Field, Message: fe.Message}
	}

	return fmt.Errorf("check contract: %w", err)
}
