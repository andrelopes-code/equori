package httpapi

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toMoneyAPI(m money.Money) Money {
	return Money{Amount: m.Amount(), Currency: string(m.Currency())}
}

// fromMoneyAPI reports range and currency errors as field errors (Review Focus 5).
func fromMoneyAPI(field string, m Money) (money.Money, error) {
	v, err := money.New(m.Amount, money.Currency(m.Currency))
	if err != nil {
		return money.Money{}, &domain.FieldError{Field: field, Message: err.Error(), Err: domain.ErrValidation}
	}
	return v, nil
}

func dateOf(d openapi_types.Date) time.Time { return d.Time }

// location is the Location header of a created record (ADR 007, C6).
func location(collection string, id uuid.UUID) *string {
	l := BaseURL + collection + id.String()
	return &l
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
	out := Account{
		Id: a.ID, Name: a.Name, Class: AccountClass(a.Class), Currency: string(a.Instrument),
		ParentId: apiOptUUID(a.ParentID), InstitutionId: apiOptUUID(a.InstitutionID),
		OpenedOn: apiDate(a.OpenedOn), ClosedOn: apiOptDate(a.ClosedOn),
		YieldMode: AccountYieldMode(a.YieldMode), SystemRole: apiOptString(string(a.SystemRole)),
	}
	if a.Kind != "" {
		k := AccountKind(a.Kind)
		out.Kind = &k
	}
	return out
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
	return a
}

// amountOf builds an amount of any instrument; the module resolves security scales.
type amountOf func(ctx context.Context, units int64, code money.Currency) (money.Money, error)

func fromTransactionInput(ctx context.Context, in TransactionInput, amounts amountOf) (domain.Transaction, error) {
	t := domain.Transaction{
		Date: dateOf(in.Date), Description: optString(in.Description), PayeeID: optUUID(in.PayeeId),
	}
	if in.Tags != nil {
		t.Tags = *in.Tags
	}
	if in.Links != nil {
		for _, l := range *in.Links {
			t.Links = append(t.Links, domain.Link{Type: domain.LinkType(l.Type), Target: l.Target})
		}
	}
	for i, p := range in.Postings {
		field := func(name string) string { return fmt.Sprintf("postings[%d].%s", i, name) }
		amount, err := amounts(ctx, p.Amount.Amount, money.Currency(p.Amount.Currency))
		if err != nil {
			return domain.Transaction{}, &domain.FieldError{Field: field("amount"), Message: err.Error(), Err: domain.ErrValidation}
		}
		posting := domain.Posting{
			AccountID: p.AccountId, Amount: amount, SettledOn: optDate(p.SettledOn), Memo: optString(p.Memo),
		}
		if p.Weight != nil {
			if posting.Weight, err = fromMoneyAPI(field("weight"), *p.Weight); err != nil {
				return domain.Transaction{}, err
			}
		}
		if p.Original != nil {
			orig, err := fromMoneyAPI(field("original"), *p.Original)
			if err != nil {
				return domain.Transaction{}, err
			}
			posting.Original = &orig
		}
		if p.Status != nil {
			posting.Status = domain.PostingStatus(*p.Status)
		}
		if p.Statement != nil {
			m, err := domain.ParseReferenceMonth(*p.Statement)
			if err != nil {
				return domain.Transaction{}, &domain.FieldError{Field: field("statement"), Message: "must be YYYY-MM", Err: domain.ErrValidation}
			}
			posting.Statement = &m
		}
		if p.CardRole != nil {
			posting.CardRole = string(*p.CardRole)
		}
		t.Postings = append(t.Postings, posting)
	}
	return t, nil
}

func toTransactionAPI(t domain.Transaction) Transaction {
	out := Transaction{
		Id: t.ID, Date: apiDate(t.Date), Description: t.Description, PayeeId: apiOptUUID(t.PayeeID),
		BalancingCurrency: string(t.BalancingCurrency), Origin: TransactionOrigin(t.Origin), Version: t.Version,
		VoidedAt: t.VoidedAt, VoidReason: apiOptString(t.VoidReason),
		Tags: append([]string{}, t.Tags...), Links: []Link{}, Postings: make([]Posting, 0, len(t.Postings)),
	}
	for _, l := range t.Links {
		out.Links = append(out.Links, Link{Type: LinkType(l.Type), Target: l.Target})
	}
	if in := t.Income; in != nil {
		out.InvestmentIncome = &InvestmentIncome{
			AccountId: in.AccountID, CashAccountId: in.CashAccountID, IncomeType: IncomeType(in.Type),
			Gross: toMoneyAPI(in.Gross), Withheld: toMoneyAPI(in.Withheld),
		}
	}
	if tr := t.Trade; tr != nil {
		out.Trade = &Trade{
			AccountId: tr.AccountID, CashAccountId: tr.CashAccountID, Side: TradeSide(tr.Side), Quantity: toMoneyAPI(tr.Quantity),
			UnitPrice: tr.UnitPrice.String(), Gross: toMoneyAPI(tr.Gross), Fees: toMoneyAPI(tr.Fees), Taxes: toMoneyAPI(tr.Taxes),
		}
		if tr.Cost != nil {
			cost := toMoneyAPI(*tr.Cost)
			out.Trade.Cost = &cost
		}
	}
	for _, p := range t.Postings {
		ap := Posting{
			Id: p.ID, AccountId: p.AccountID, Amount: toMoneyAPI(p.Amount), Weight: toMoneyAPI(p.Weight),
			Status: PostingStatus(p.Status), SettledOn: apiOptDate(p.SettledOn), Memo: apiOptString(p.Memo),
		}
		if p.Original != nil {
			o := toMoneyAPI(*p.Original)
			ap.Original = &o
		}
		if p.Statement != nil {
			ref := p.Statement.String()
			ap.Statement = &ref
		}
		if p.CardRole != "" {
			role := PostingCardRole(p.CardRole)
			ap.CardRole = &role
		}
		if p.Installment != nil {
			ap.Installment = &Installment{PlanId: p.Installment.PlanID, Number: p.Installment.Number, Count: p.Installment.Count}
		}
		out.Postings = append(out.Postings, ap)
	}
	return out
}

func toInstitutionAPI(i app.Institution) Institution {
	return Institution{Id: i.ID, Name: i.Name, Code: apiOptString(i.Code)}
}

func toPayeeAPI(p app.Payee) Payee { return Payee{Id: p.ID, Name: p.Name} }
