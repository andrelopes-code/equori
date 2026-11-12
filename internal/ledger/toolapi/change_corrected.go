package toolapi

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func correctedTransaction(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	cur domain.Transaction,
	in changeTransactionIn,
) (domain.Transaction, error) {
	next := copyTransaction(cur)
	if err := applyCorrectedFields(&next, in); err != nil {
		return next, err
	}

	from, to, two := sides(cur)
	if err := checkCorrectedSides(in, two); err != nil {
		return next, err
	}

	if in.Amount != "" {
		if err := applyCorrectedAmount(&next, cur, in, from, to); err != nil {
			return next, err
		}
	}

	if err := applyCorrectedAccounts(ctx, svc, booksID, &next, in, from, to); err != nil {
		return next, err
	}

	return next, nil
}

func copyTransaction(cur domain.Transaction) domain.Transaction {
	next := domain.Transaction{
		Date: cur.Date, Description: cur.Description, PayeeID: cur.PayeeID, Tags: cur.Tags, Links: cur.Links,
		Origin: cur.Origin,
	}
	for _, po := range cur.Postings {
		next.Postings = append(next.Postings, domain.Posting{
			AccountID: po.AccountID,
			Amount:    po.Amount,
			Weight:    po.Weight,
			Memo:      po.Memo,
		})
	}

	return next
}

func applyCorrectedFields(next *domain.Transaction, in changeTransactionIn) error {
	if !in.Date.IsZero() {
		next.Date = in.Date.Time
	}

	if in.Description != "" {
		next.Description = in.Description
	}

	if in.PayeeID != "" {
		id, err := optionalID(in.PayeeID, "payee_id")
		if err != nil {
			return err
		}

		next.PayeeID = id
	}

	if in.Tags != nil {
		next.Tags = in.Tags
	}

	return nil
}

func checkCorrectedSides(in changeTransactionIn, two bool) error {
	fields := map[string]bool{
		"amount": in.Amount != "", "from_account_id": in.FromAccountID != "", "to_account_id": in.ToAccountID != "",
	}
	for field, given := range fields {
		if given && !two {
			return tool.InvalidArgument(field, "applies only to a transaction with one source and one destination")
		}
	}

	return nil
}

func applyCorrectedAmount(next *domain.Transaction, cur domain.Transaction, in changeTransactionIn, from, to int) error {
	amount, err := tool.ParsePositive("amount", in.Amount, cur.Postings[from].Amount)
	if err != nil {
		return err
	}

	next.Postings[from].Amount, next.Postings[to].Amount = amount.Neg(), amount
	next.Postings[from].Weight, next.Postings[to].Weight = money.Money{}, money.Money{}

	return nil
}

func applyCorrectedAccounts(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	next *domain.Transaction,
	in changeTransactionIn,
	from, to int,
) error {
	for idx, s := range map[int]string{from: in.FromAccountID, to: in.ToAccountID} {
		if s == "" {
			continue
		}

		field := "from_account_id"
		if idx == to {
			field = "to_account_id"
		}

		id, err := requiredID(s, field)
		if err != nil {
			return err
		}

		a, err := svc.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		next.Postings[idx].AccountID = a.ID
	}

	return nil
}

func correctionChanges(ctx context.Context, svc *app.Service, booksID int64, p changePlan, accounts map[uuid.UUID]domain.Account) ([]tool.Change, error) {
	cur, next := p.current, p.next

	var out []tool.Change
	if !cur.Date.Equal(next.Date) {
		out = append(out, tool.Change{Field: "date", Before: tool.DateValue(cur.Date), After: tool.DateValue(next.Date)})
	}

	if cur.Description != next.Description {
		out = append(out, tool.Change{Field: "description", Before: tool.TextValue(cur.Description), After: tool.TextValue(next.Description)})
	}

	if cur.PayeeID != next.PayeeID {
		names, err := svc.PayeeNames(ctx, booksID, []uuid.UUID{cur.PayeeID, next.PayeeID})
		if err != nil {
			return nil, err
		}

		out = append(out, tool.Change{Field: "payee", Before: tool.TextValue(names[cur.PayeeID]), After: tool.TextValue(names[next.PayeeID])})
	}

	if a, b := strings.Join(cur.Tags, ", "), strings.Join(next.Tags, ", "); a != b {
		out = append(out, tool.Change{Field: "tags", Before: tool.TextValue(a), After: tool.TextValue(b)})
	}

	if from, to, ok := sides(cur); ok {
		if a, b := cur.Postings[to].Amount, next.Postings[to].Amount; a != b {
			out = append(out, tool.Change{Field: "amount", Before: tool.MoneyValue(a), After: tool.MoneyValue(b)})
		}

		for _, i := range []int{from, to} {
			a, b := accounts[cur.Postings[i].AccountID], accounts[next.Postings[i].AccountID]
			if a.ID == b.ID {
				continue
			}

			field := "account"
			if b.IsCategory() {
				field = "category"
			}

			out = append(out, tool.Change{Field: field, Before: tool.TextValue(a.Name), After: tool.TextValue(b.Name)})
		}
	}

	return out, nil
}
