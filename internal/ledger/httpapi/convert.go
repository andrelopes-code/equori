package httpapi

import (
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toMoneyAPI(m money.Money) Money {
	return Money{Amount: m.Amount(), Currency: string(m.Currency())}
}

// fromMoneyAPI reports range and currency errors as field errors (Review Focus 5).
func fromMoneyAPI(field string, m Money) (money.Money, error) {
	v, err := money.New(m.Amount, money.Currency(m.Currency))
	if err != nil {
		return money.Money{}, &domain.FieldError{
			Field:   field,
			Message: err.Error(),
			Err:     domain.ErrValidation,
		}
	}

	return v, nil
}

// linkAmountAPI is nil for a link that holds no amount.
func linkAmountAPI(amount int64, currency string) *Money {
	if amount == 0 {
		return nil
	}

	return &Money{Amount: amount, Currency: currency}
}

func dateOf(d openapi_types.Date) time.Time { return d.Time }

// location is the Location header of a created record (ADR 007, C6).
func location(collection string, id uuid.UUID) string {
	return BaseURL + collection + id.String()
}

func apiDate(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }

func optDate(d *openapi_types.Date) *time.Time {
	if d == nil {
		return nil
	}

	t := d.Time

	return &t
}

func apiOptDate(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}

	return &openapi_types.Date{Time: *t}
}

func optUUID(id *openapi_types.UUID) uuid.UUID {
	if id == nil {
		return uuid.Nil
	}

	return *id
}

func apiOptUUID(id uuid.UUID) *openapi_types.UUID {
	if id == uuid.Nil {
		return nil
	}

	return &id
}

func optString(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

func apiOptString(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func toAccountAPI(a domain.Account) Account {
	excluded := a.ExcludedFromLiquidity

	out := Account{
		ExcludedFromLiquidity: &excluded,
		Id:                    a.ID,
		Name:                  a.Name,
		Class:                 AccountClass(a.Class),
		Currency:              string(a.Instrument),
		ParentId:              apiOptUUID(a.ParentID),
		InstitutionId:         apiOptUUID(a.InstitutionID),
		OpenedOn:              apiDate(a.OpenedOn),
		ClosedOn:              apiOptDate(a.ClosedOn),
		YieldMode:             AccountYieldMode(a.YieldMode),
		SystemRole:            apiOptString(string(a.SystemRole)),
	}
	if a.Kind != "" {
		k := AccountKind(a.Kind)
		out.Kind = &k
	}

	if a.Color != 0 {
		c := a.Color
		out.Color = &c
	}

	if a.Icon != "" {
		i := CategoryIcon(a.Icon)
		out.Icon = &i
	}

	out.Face = toCardFaceAPI(a.Face)

	return out
}

// toCardFaceAPI returns nil when no value is set and only the set values otherwise.
func toCardFaceAPI(f domain.CardFace) *CardFace {
	if f == (domain.CardFace{}) {
		return nil
	}

	out := CardFace{
		Color: apiOptString(f.Color),
		Art:   apiOptString(f.Art),
	}

	if f.Chip != "" {
		chip := CardFaceChip(f.Chip)
		out.Chip = &chip
	}

	if f.Orientation != "" {
		orientation := CardFaceOrientation(f.Orientation)
		out.Orientation = &orientation
	}

	if f.Brand != "" {
		brand := CardFaceBrand(f.Brand)
		out.Brand = &brand
	}

	return &out
}

func fromAccountInput(in AccountInput) domain.Account {
	a := domain.Account{
		Name: in.Name, Class: domain.Class(in.Class), Instrument: money.Currency(in.Currency),
		ParentID: optUUID(in.ParentId), InstitutionID: optUUID(in.InstitutionId),
	}
	if in.Kind != nil {
		a.Kind = domain.Kind(*in.Kind)
	}

	if in.OpenedOn != nil {
		a.OpenedOn = in.OpenedOn.Time
	}

	if in.YieldMode != nil {
		a.YieldMode = domain.YieldMode(*in.YieldMode)
	}

	if in.Color != nil {
		a.Color = *in.Color
	}

	if in.Icon != nil {
		a.Icon = string(*in.Icon)
	}

	return a
}

func toInstitutionAPI(i app.Institution) Institution {
	out := Institution{Id: i.ID, Name: i.Name, Code: apiOptString(i.Code)}
	if i.Identifier != (app.InstitutionIdentifier{}) {
		out.Identifier = &InstitutionIdentifier{
			Scheme:     i.Identifier.Scheme,
			Identifier: i.Identifier.Value,
		}
	}

	return out
}

func toPayeeAPI(p app.Payee) Payee { return Payee{Id: p.ID, Name: p.Name} }
