package pluggy

import (
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// Normalize translates a Pluggy transaction of account a into a record from the account's
// point of view. ok is false for lines that are not recorded: a pending bank line is a
// scheduled payment (P6 amendment A36). scale is the account currency's.
func Normalize(t Transaction, a Account, bills map[string]Bill, scale int, loc *time.Location) (r domain.NormalizedRecord, ok bool, err error) {
	card := a.Subtype == SubtypeCard
	pending := t.Status == statusPending
	if pending && !card {
		return domain.NormalizedRecord{}, false, nil
	}
	if t.ID == "" {
		return domain.NormalizedRecord{}, false, errors.New("transaction without id")
	}
	r = domain.NormalizedRecord{ExternalID: t.ID, Description: t.Description, Pending: pending, Raw: raw(t)}
	if t.DescriptionRaw != nil && *t.DescriptionRaw != "" {
		r.Description = *t.DescriptionRaw
	}
	if r.Date, err = Date(t.Date, loc); err != nil {
		return domain.NormalizedRecord{}, false, fmt.Errorf("transaction %s: %w", t.ID, err)
	}
	amount := t.Amount
	if t.CurrencyCode != "" && t.CurrencyCode != a.CurrencyCode {
		if t.AmountInAccountCurrency == "" {
			return domain.NormalizedRecord{}, false, fmt.Errorf("transaction %s: %w: no amount in %s", t.ID, ErrAmount, a.CurrencyCode)
		}
		amount = t.AmountInAccountCurrency
	}
	if r.Amount, err = Minor(amount, scale); err != nil {
		return domain.NormalizedRecord{}, false, fmt.Errorf("transaction %s: %w", t.ID, err)
	}
	if card {
		// Pluggy card amounts are positive for charges; the ledger's card charges are negative.
		r.Amount = -r.Amount
	}
	if t.Balance != "" && !card {
		if b, err := Minor(t.Balance, scale); err == nil {
			r.BalanceAfter = &b
		}
	}
	if t.CategoryID != nil && *t.CategoryID != "" {
		r.Category = &domain.SourceCategory{ID: *t.CategoryID}
		if t.Category != nil {
			r.Category.Name = *t.Category
		}
	}
	if m := t.CreditCardMetadata; card && m != nil {
		if m.BillID != nil {
			if b, found := bills[*m.BillID]; found {
				due, err := Date(b.DueDate, loc)
				if err != nil {
					return domain.NormalizedRecord{}, false, fmt.Errorf("bill %s: %w", b.ID, err)
				}
				r.DueDate = &due
			}
		}
		if m.InstallmentNumber > 0 && m.TotalInstallments > 1 {
			r.Installment = &domain.Installment{Number: m.InstallmentNumber, Count: m.TotalInstallments, PurchaseDate: r.Date}
			if m.PurchaseDate != nil {
				if r.Installment.PurchaseDate, err = Date(*m.PurchaseDate, loc); err != nil {
					return domain.NormalizedRecord{}, false, fmt.Errorf("transaction %s purchase date: %w", t.ID, err)
				}
			}
		}
	}
	return r, true, nil
}

// Date reads a Pluggy date: midnight UTC is that calendar date; any other instant is the
// date in loc (P6 amendment A37).
func Date(s string, loc *time.Location) (time.Time, error) {
	if d, err := time.Parse(time.DateOnly, s); err == nil {
		return d, nil
	}
	ts, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}, fmt.Errorf("%q is not an ISO 8601 date", s)
	}
	if u := ts.UTC(); u.Hour() == 0 && u.Minute() == 0 && u.Second() == 0 && u.Nanosecond() == 0 {
		return time.Date(u.Year(), u.Month(), u.Day(), 0, 0, 0, 0, time.UTC), nil
	}
	l := ts.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC), nil
}

// raw keeps the source fields that explain the record, without account numbers (N16).
func raw(t Transaction) map[string]string {
	m := map[string]string{"id": t.ID, "description": t.Description, "amount": string(t.Amount), "date": t.Date, "status": t.Status, "currency": t.CurrencyCode}
	if t.DescriptionRaw != nil {
		m["description_raw"] = *t.DescriptionRaw
	}
	if t.AmountInAccountCurrency != "" {
		m["amount_in_account_currency"] = string(t.AmountInAccountCurrency)
	}
	if t.CategoryID != nil {
		m["category_id"] = *t.CategoryID
	}
	if c := t.CreditCardMetadata; c != nil {
		if c.BillID != nil {
			m["bill_id"] = *c.BillID
		}
		if c.InstallmentNumber > 0 {
			m["installment"] = fmt.Sprintf("%d/%d", c.InstallmentNumber, c.TotalInstallments)
		}
	}
	return m
}
