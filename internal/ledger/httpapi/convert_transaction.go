package httpapi

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// amountOf builds an amount of any instrument; the module resolves security scales.
type amountOf func(ctx context.Context, units int64, code money.Currency) (money.Money, error)

func fromTransactionInput(
	ctx context.Context,
	in TransactionInput,
	amounts amountOf,
) (domain.Transaction, error) {
	t := domain.Transaction{
		Date: dateOf(in.Date), Description: optString(in.Description), PayeeID: optUUID(in.PayeeId),
	}
	if in.Tags != nil {
		t.Tags = *in.Tags
	}

	if in.Links != nil {
		// An empty list is not an omitted one: a correction clears the first and keeps the second.
		t.Links = []domain.Link{}
		for _, l := range *in.Links {
			link := domain.Link{Type: domain.LinkType(l.Type), Target: l.Target}
			if l.Amount != nil {
				link.Amount = l.Amount.Amount
			}

			t.Links = append(t.Links, link)
		}
	}

	for i, p := range in.Postings {
		posting, err := fromPostingInput(ctx, i, p, amounts)
		if err != nil {
			return domain.Transaction{}, err
		}

		t.Postings = append(t.Postings, posting)
	}

	return t, nil
}

func fromPostingInput(
	ctx context.Context,
	i int,
	p PostingInput,
	amounts amountOf,
) (domain.Posting, error) {
	field := func(name string) string { return fmt.Sprintf("postings[%d].%s", i, name) }

	amount, err := amounts(ctx, p.Amount.Amount, money.Currency(p.Amount.Currency))
	if err != nil {
		return domain.Posting{}, &domain.FieldError{
			Field:   field("amount"),
			Message: err.Error(),
			Err:     domain.ErrValidation,
		}
	}

	posting := domain.Posting{
		AccountID: p.AccountId,
		Amount:    amount,
		SettledOn: optDate(p.SettledOn),
		Memo:      optString(p.Memo),
	}
	if err = fillPostingExtras(field, p, &posting); err != nil {
		return domain.Posting{}, err
	}

	return posting, nil
}

func fillPostingExtras(field func(string) string, p PostingInput, posting *domain.Posting) error {
	var err error

	if p.Weight != nil {
		if posting.Weight, err = fromMoneyAPI(field("weight"), *p.Weight); err != nil {
			return err
		}
	}

	if p.Original != nil {
		orig, err := fromMoneyAPI(field("original"), *p.Original)
		if err != nil {
			return err
		}

		posting.Original = &orig
	}

	if p.Status != nil {
		posting.Status = domain.PostingStatus(*p.Status)
	}

	if p.Statement != nil {
		m, err := domain.ParseReferenceMonth(*p.Statement)
		if err != nil {
			return &domain.FieldError{
				Field:   field("statement"),
				Message: "must be YYYY-MM",
				Err:     domain.ErrValidation,
			}
		}

		posting.Statement, posting.StatementBasis = &m, domain.BasisOwner
	}

	if p.CardRole != nil {
		posting.CardRole = string(*p.CardRole)
	}

	return nil
}

func toTransactionAPI(t domain.Transaction) Transaction {
	out := Transaction{
		Id:          t.ID,
		Date:        apiDate(t.Date),
		Description: t.Description,
		PayeeId:     apiOptUUID(t.PayeeID),
		BalancingCurrency: string(
			t.BalancingCurrency,
		),
		Origin:     TransactionOrigin(t.Origin),
		Version:    t.Version,
		VoidedAt:   t.VoidedAt,
		VoidReason: apiOptString(t.VoidReason),
		Tags: append(
			[]string{},
			t.Tags...),
		Links:    []Link{},
		Postings: make([]Posting, 0, len(t.Postings)),
	}
	for _, l := range t.Links {
		out.Links = append(
			out.Links,
			Link{
				Type:   LinkType(l.Type),
				Target: l.Target,
				Amount: linkAmountAPI(l.Amount, string(t.BalancingCurrency)),
			},
		)
	}

	setInvestment(&out, t)

	for _, p := range t.Postings {
		out.Postings = append(out.Postings, toPostingAPI(p))
	}

	return out
}

func setInvestment(out *Transaction, t domain.Transaction) {
	if in := t.Income; in != nil {
		out.InvestmentIncome = &InvestmentIncome{
			AccountId:     in.AccountID,
			CashAccountId: in.CashAccountID,
			IncomeType:    IncomeType(in.Type),
			Gross:         toMoneyAPI(in.Gross),
			Withheld:      toMoneyAPI(in.Withheld),
		}
	}

	if tr := t.Trade; tr != nil {
		out.Trade = &Trade{
			AccountId:     tr.AccountID,
			CashAccountId: tr.CashAccountID,
			Side:          TradeSide(tr.Side),
			Quantity:      toMoneyAPI(tr.Quantity),
			UnitPrice:     tr.UnitPrice.String(),
			Gross:         toMoneyAPI(tr.Gross),
			Fees:          toMoneyAPI(tr.Fees),
			Taxes:         toMoneyAPI(tr.Taxes),

			DayTradeQuantity: toMoneyAPI(tr.DayTradeQuantity),
			DayTradeCost:     toMoneyAPI(tr.DayTradeCost),

			SettlementDate: apiDate(settlementDate(t, tr)),
		}
		if tr.Cost != nil {
			cost := toMoneyAPI(*tr.Cost)
			out.Trade.Cost = &cost
		}
	}
}

// settlementDate is the SettledOn of the cash posting of trade tr, else the transaction date
// (A228 IO9).
func settlementDate(t domain.Transaction, tr *domain.Trade) time.Time {
	for _, p := range t.Postings {
		if p.AccountID == tr.CashAccountID && p.SettledOn != nil {
			return *p.SettledOn
		}
	}

	return t.Date
}

func toPostingAPI(p domain.Posting) Posting {
	ap := Posting{
		Id:        p.ID,
		AccountId: p.AccountID,
		Amount:    toMoneyAPI(p.Amount),
		Weight:    toMoneyAPI(p.Weight),
		Status: PostingStatus(
			p.Status,
		),
		SettledOn: apiOptDate(p.SettledOn),
		Memo:      apiOptString(p.Memo),
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
		ap.Installment = &Installment{
			PlanId: p.Installment.PlanID,
			Number: p.Installment.Number,
			Count:  p.Installment.Count,
		}
	}

	return ap
}
