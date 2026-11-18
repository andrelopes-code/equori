package httpapi

import (
	"context"
	"math/big"

	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// fractionPlaces is the most decimals of CorporateAction.fraction (A228 IO26).
const fractionPlaces = 12

func (s *Server) recordCorporateAction(
	ctx context.Context,
	r *http.Request,
	in RecordCorporateActionJSONRequestBody,
) (Transaction, string, error) {
	o, err := s.actionOrderFromInput(ctx, in)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.RecordCorporateAction(ctx, auth.MustBooksID(ctx), o)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) actionOrderFromInput(
	ctx context.Context,
	b CorporateActionInput,
) (domain.ActionOrder, error) {
	instrument, err := s.svc.ResolveCode(ctx, money.Currency(optString(b.Instrument)))
	if err != nil {
		return domain.ActionOrder{}, err
	}

	o := domain.ActionOrder{
		AccountID:   optUUID(b.AccountId),
		BrokerageID: optUUID(b.BrokerageId),
		CategoryID:  optUUID(b.CategoryId),
		Instrument:  instrument,
		Kind:        domain.ActionKind(b.Kind),
		Date:        dateOf(b.Date),
		RatioFrom:   b.RatioFrom,
		RatioTo:     b.RatioTo,
		Description: optString(b.Description),
	}
	if b.NewInstrument != nil {
		o.NewInstrument = money.Currency(*b.NewInstrument)
	}

	if b.CostBp != nil {
		o.CostBP = *b.CostBp
	}

	o.CashAccountID = optUUID(b.CashAccountId)

	if b.UnitCost != nil {
		cost, err := money.ParseRate(*b.UnitCost)
		if err != nil {
			return domain.ActionOrder{}, &domain.FieldError{
				Field:   "unit_cost",
				Message: "must be a positive decimal with at most 12 decimals",
				Err:     domain.ErrValidation,
			}
		}

		o.UnitCost = &cost
	}

	if err := s.unitTaxFromInput(ctx, b, &o); err != nil {
		return domain.ActionOrder{}, err
	}

	return o, nil
}

// unitTaxFromInput sets the quantity and the amount of a unit tax; absent, they stay zero and
// the domain reports the field.
func (s *Server) unitTaxFromInput(
	ctx context.Context,
	b CorporateActionInput,
	o *domain.ActionOrder,
) error {
	if b.Quantity != nil {
		code, err := s.svc.ResolveCode(ctx, money.Currency(b.Quantity.Currency))
		if err != nil {
			return err
		}

		if o.Quantity, err = s.svc.AmountOf(ctx, b.Quantity.Amount, code); err != nil {
			return err
		}
	}

	if b.Amount != nil {
		amount, err := fromMoneyAPI("amount", *b.Amount)
		if err != nil {
			return err
		}

		o.Amount = amount
	}

	return nil
}

func toCorporateActionAPI(a domain.CorporateAction) *CorporateAction {
	out := &CorporateAction{
		AccountId: a.AccountID,
		Kind:      CorporateActionKind(a.Kind),
		RatioFrom: a.RatioFrom,
		RatioTo:   a.RatioTo,
		Held:      toMoneyAPI(a.Held),
		Received:  toMoneyAPI(a.Received),
		Fraction:  fractionOf(a),
		Value:     toMoneyAPI(a.Value),
	}
	if a.UnitCost != nil {
		cost := a.UnitCost.String()
		out.UnitCost = &cost
	}

	if a.NewAccountID != uuid.Nil {
		out.NewAccountId = &a.NewAccountID
	}

	if a.CostBP != 0 {
		out.CostBp = &a.CostBP
	}

	return out
}

// fractionOf is the remainder over ratio_from × 10^scale as a decimal of at most 12 places,
// half to even, without trailing zeros (A228 IO26).
func fractionOf(a domain.CorporateAction) string {
	places := new(big.Int).Exp(big.NewInt(10), big.NewInt(fractionPlaces), nil)
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(a.Held.Scale())), nil)

	numerator := new(big.Int).Mul(big.NewInt(a.FractionRemainder), places)
	denominator := new(big.Int).Mul(big.NewInt(a.RatioFrom), scale)

	quotient, rest := new(big.Int).QuoRem(numerator, denominator, new(big.Int))
	if c := rest.Lsh(rest, 1).Cmp(denominator); c > 0 || (c == 0 && quotient.Bit(0) == 1) {
		quotient.Add(quotient, big.NewInt(1))
	}

	digits := quotient.String()
	digits = strings.Repeat("0", fractionPlaces+1-len(digits)) + digits

	whole := digits[:len(digits)-fractionPlaces]
	decimals := strings.TrimRight(digits[len(digits)-fractionPlaces:], "0")

	if decimals == "" {
		return whole
	}

	return whole + "." + decimals
}
