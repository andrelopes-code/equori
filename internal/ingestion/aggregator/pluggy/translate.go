package pluggy

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

const statusPending = "PENDING"

// operationReservedTransfer is the operation type of a line that moves money between a
// bank account and one of its reserved balances (A76).
const operationReservedTransfer = "TRANSFERENCIA_SALDO_RESERVADO"

const (
	reservedPrefix  = "Dinheiro reservado "
	withdrawnPrefix = "Dinheiro retirado "
)

var documentSchemes = map[string]string{"CPF": "br_cpf", "CNPJ": "br_cnpj"}

// cardKinds are the card operation types that state a line's type (A88); any other type
// follows the amount's sign.
var cardKinds = map[string]string{"PAGAMENTO_FATURA": domain.KindPayment, "ESTORNO": domain.KindRefund}

// Normalize translates a Pluggy transaction of account a into a record from the account's
// point of view. ok is false for lines that are not recorded: a pending bank line is a
// scheduled payment (P6 amendment A36). scale is the account currency's.
func Normalize(
	t client.Transaction,
	a client.Account,
	bills map[string]client.Bill,
	scale int,
	loc *time.Location,
) (r domain.NormalizedRecord, ok bool, err error) {
	card := a.Subtype == client.SubtypeCard

	if skipPending(t, card) {
		return domain.NormalizedRecord{}, false, nil
	}

	if t.ID == "" {
		return domain.NormalizedRecord{}, false, errors.New("transaction without id")
	}

	r = domain.NormalizedRecord{
		ExternalID:  t.ID,
		Description: t.Description,
		Pending:     t.Status == statusPending,
		Raw:         raw(t),
	}
	applyLabels(&r, t)

	if r.Date, err = Date(t.Date, loc); err != nil {
		return domain.NormalizedRecord{}, false, fmt.Errorf("transaction %s: %w", t.ID, err)
	}

	if r.Amount, err = readAmount(t, a, scale); err != nil {
		return domain.NormalizedRecord{}, false, err
	}

	r.Counterparty = counterparty(t.PaymentData, r.Amount)

	if card {
		// Pluggy card amounts are positive for charges; the ledger's card charges are negative.
		r.Amount = -r.Amount
	}

	if !card {
		applyBankFields(&r, t, scale)
	}

	if card {
		if err := applyCardFields(&r, t, bills, scale, loc); err != nil {
			return domain.NormalizedRecord{}, false, err
		}
	}

	return r, true, nil
}

// ReadBill reads a card bill (A85): its total and minimum rounded to the currency's scale.
func ReadBill(b client.Bill, scale int, loc *time.Location) (domain.Bill, error) {
	due, err := Date(b.DueDate, loc)
	if err != nil {
		return domain.Bill{}, fmt.Errorf("bill %s: %w", b.ID, err)
	}

	out := domain.Bill{Due: due}
	if b.BillClosingDate != nil && *b.BillClosingDate != "" {
		closing, err := Date(*b.BillClosingDate, loc)
		if err != nil {
			return domain.Bill{}, fmt.Errorf("bill %s: %w", b.ID, err)
		}

		out.Closing = &closing
	}

	if out.Total, err = client.Rounded(b.TotalAmount, scale); err != nil {
		return domain.Bill{}, fmt.Errorf("bill %s: %w", b.ID, err)
	}

	if b.MinimumPaymentAmount != "" {
		if minimum, err := client.Rounded(b.MinimumPaymentAmount, scale); err == nil {
			out.Minimum = &minimum
		}
	}

	return out, nil
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

// skipPending reports a pending bank line: a scheduled payment, not recorded.
func skipPending(t client.Transaction, card bool) bool {
	return t.Status == statusPending && !card
}

// applyLabels sets the description, institution and source category of a line.
func applyLabels(r *domain.NormalizedRecord, t client.Transaction) {
	if t.DescriptionRaw != nil && *t.DescriptionRaw != "" {
		r.Description = *t.DescriptionRaw
	}

	if t.ProviderID != nil && *t.ProviderID != "" {
		r.InstitutionID = *t.ProviderID
	}

	if t.CategoryID != nil && *t.CategoryID != "" {
		r.Category = &domain.SourceCategory{ID: *t.CategoryID}
		if t.Category != nil {
			r.Category.Name = *t.Category
		}
	}
}

// readAmount reads the line's amount in the account's currency.
func readAmount(t client.Transaction, a client.Account, scale int) (int64, error) {
	amount := t.Amount
	if t.CurrencyCode != "" && t.CurrencyCode != a.CurrencyCode {
		if t.AmountInAccountCurrency == "" {
			return 0, fmt.Errorf(
				"transaction %s: %w: no amount in %s", t.ID, client.ErrAmount, a.CurrencyCode,
			)
		}

		amount = t.AmountInAccountCurrency
	}

	minor, err := client.Minor(amount, scale)
	if err != nil {
		return 0, fmt.Errorf("transaction %s: %w", t.ID, err)
	}

	return minor, nil
}

// applyBankFields sets the reserve and balance fields of a bank line; r.Amount is final.
func applyBankFields(r *domain.NormalizedRecord, t client.Transaction, scale int) {
	r.ReserveMove = t.OperationType != nil && *t.OperationType == operationReservedTransfer
	r.ReserveName = reserveName(t, r.Amount)

	if t.Balance != "" {
		if b, err := client.Minor(t.Balance, scale); err == nil {
			r.BalanceAfter = &b
		}
	}
}

// applyCardFields sets the kind, due date and installment of a card line.
func applyCardFields(
	r *domain.NormalizedRecord,
	t client.Transaction,
	bills map[string]client.Bill,
	scale int,
	loc *time.Location,
) error {
	if t.OperationType != nil {
		r.Kind = cardKinds[*t.OperationType]
	}

	m := t.CreditCardMetadata
	if m == nil {
		return nil
	}

	if err := readDueDate(r, m, bills, loc); err != nil {
		return err
	}

	if m.InstallmentNumber > 0 && m.TotalInstallments > 1 {
		return readInstallment(r, t, scale, loc)
	}

	return nil
}

// readDueDate sets the due date of the bill the line belongs to, when the bill is known.
func readDueDate(
	r *domain.NormalizedRecord,
	m *client.CardMetadata,
	bills map[string]client.Bill,
	loc *time.Location,
) error {
	if m.BillID == nil {
		return nil
	}

	b, found := bills[*m.BillID]
	if !found {
		return nil
	}

	due, err := Date(b.DueDate, loc)
	if err != nil {
		return fmt.Errorf("bill %s: %w", b.ID, err)
	}

	r.DueDate = &due

	return nil
}

// readInstallment sets the installment of a card line; r.Date is final.
func readInstallment(
	r *domain.NormalizedRecord,
	t client.Transaction,
	scale int,
	loc *time.Location,
) (err error) {
	m := t.CreditCardMetadata

	r.Installment = &domain.Installment{
		Number:       m.InstallmentNumber,
		Count:        m.TotalInstallments,
		PurchaseDate: r.Date,
	}
	if m.TotalAmount != "" {
		if total, err := client.Minor(m.TotalAmount, scale); err == nil && total > 0 {
			r.Installment.Total = &total
		}
	}

	if m.PurchaseDate != nil {
		if r.Installment.PurchaseDate, err = Date(*m.PurchaseDate, loc); err != nil {
			return fmt.Errorf("transaction %s purchase date: %w", t.ID, err)
		}
	}

	return nil
}

// counterparty returns the receiver of a debit or the payer of a credit; nil for a document
// type other than CPF and CNPJ, an empty value or a missing party (A217).
func counterparty(p *client.PaymentData, amount int64) *domain.PartyID {
	if p == nil {
		return nil
	}

	party := p.Payer
	if amount < 0 {
		party = p.Receiver
	}

	if party == nil || party.DocumentNumber == nil || party.DocumentNumber.Value == "" {
		return nil
	}

	scheme, ok := documentSchemes[party.DocumentNumber.Type]
	if !ok {
		return nil
	}

	return &domain.PartyID{Scheme: scheme, Value: party.DocumentNumber.Value}
}

// reserveName returns the reserved balance a bank line moves money into (negative amount) or
// out of (positive amount); the line carries only the reserve's name (A76). Case and spacing of
// the wording do not change its meaning (A212).
func reserveName(t client.Transaction, amount int64) string {
	if t.OperationType == nil || *t.OperationType != operationReservedTransfer {
		return ""
	}

	text := strings.Join(strings.Fields(t.Description), " ")

	if name, ok := cutWording(text, reservedPrefix); ok && amount < 0 {
		return name
	}

	if name, ok := cutWording(text, withdrawnPrefix); ok && amount > 0 {
		return name
	}

	return ""
}

func cutWording(text, wording string) (string, bool) {
	if len(text) < len(wording) || !strings.EqualFold(text[:len(wording)], wording) {
		return "", false
	}

	return text[len(wording):], true
}

// raw keeps the source fields that explain the record, without account numbers (N16).
func raw(t client.Transaction) map[string]string {
	m := map[string]string{
		"id":          t.ID,
		"description": t.Description,
		"amount":      string(t.Amount),
		"date":        t.Date,
		"status":      t.Status,
		"currency":    t.CurrencyCode,
	}
	if t.DescriptionRaw != nil {
		m["description_raw"] = *t.DescriptionRaw
	}

	if t.AmountInAccountCurrency != "" {
		m["amount_in_account_currency"] = string(t.AmountInAccountCurrency)
	}

	if t.CategoryID != nil {
		m["category_id"] = *t.CategoryID
	}

	if t.ProviderID != nil && *t.ProviderID != "" {
		m["provider_id"] = *t.ProviderID
	}

	if t.OperationType != nil {
		m["operation_type"] = *t.OperationType
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
