package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// snapshot is the JSON form of a replaced transaction version (ledger_transaction_version).
type snapshot struct {
	ID                uuid.UUID         `json:"id"`
	BooksID           int64             `json:"books_id"`
	Date              string            `json:"date"`
	Description       string            `json:"description"`
	PayeeID           uuid.UUID         `json:"payee_id"`
	BalancingCurrency string            `json:"balancing_currency"`
	Origin            string            `json:"origin"`
	Version           int               `json:"version"`
	Tags              []string          `json:"tags"`
	Links             []snapshotLink    `json:"links"`
	Postings          []snapshotPosting `json:"postings"`
	Trade             *snapshotTrade    `json:"trade,omitempty"`
	Income            *snapshotIncome   `json:"income,omitempty"`
}

// snapshotTrade and snapshotIncome keep the detail a correction replaces (A227 IC8). Amounts
// are minor units: the quantity of the security, the rest of currency.
type snapshotTrade struct {
	AccountID     uuid.UUID `json:"account_id"`
	CashAccountID uuid.UUID `json:"cash_account_id"`
	Side          string    `json:"side"`
	Quantity      int64     `json:"quantity"`
	Instrument    string    `json:"instrument"`
	UnitPrice     string    `json:"unit_price"`
	Gross         int64     `json:"gross"`
	Fees          int64     `json:"fees"`
	Taxes         int64     `json:"taxes"`
	Cost          *int64    `json:"cost,omitempty"`
	Currency      string    `json:"currency"`
}

type snapshotIncome struct {
	AccountID     uuid.UUID `json:"account_id"`
	CashAccountID uuid.UUID `json:"cash_account_id"`
	Type          string    `json:"type"`
	Gross         int64     `json:"gross"`
	Withheld      int64     `json:"withheld"`
	Currency      string    `json:"currency"`
}

type snapshotLink struct {
	Type   string    `json:"type"`
	Target uuid.UUID `json:"target"`
	Amount int64     `json:"amount,omitempty"`
}

type snapshotPosting struct {
	AccountID          uuid.UUID              `json:"account_id"`
	Amount             int64                  `json:"amount"`
	Currency           string                 `json:"currency"`
	Weight             int64                  `json:"weight"`
	Status             string                 `json:"status"`
	SettledOn          string                 `json:"settled_on,omitempty"`
	OriginalAmount     *int64                 `json:"original_amount,omitempty"`
	OriginalInstrument *string                `json:"original_instrument,omitempty"`
	Memo               string                 `json:"memo,omitempty"`
	Statement          string                 `json:"statement,omitempty"`
	StatementID        uuid.UUID              `json:"statement_id,omitzero"`
	StatementBasis     string                 `json:"statement_basis,omitempty"`
	CardRole           string                 `json:"card_role,omitempty"`
	Installment        *domain.InstallmentRef `json:"installment,omitempty"`
}

func toSnapshot(t domain.Transaction) snapshot {
	s := snapshot{
		ID:          t.ID,
		BooksID:     t.BooksID,
		Date:        t.Date.Format(time.DateOnly),
		Description: t.Description,
		PayeeID:     t.PayeeID,
		BalancingCurrency: string(
			t.BalancingCurrency,
		),
		Origin:  string(t.Origin),
		Version: t.Version,
		Tags:    t.Tags,
	}
	for _, l := range t.Links {
		s.Links = append(
			s.Links,
			snapshotLink{Type: string(l.Type), Target: l.Target, Amount: l.Amount},
		)
	}

	for _, p := range t.Postings {
		sp := snapshotPosting{
			AccountID: p.AccountID,
			Amount:    p.Amount.Amount(),
			Currency:  string(p.Amount.Currency()),
			Weight:    p.Weight.Amount(),
			Status: string(
				p.Status,
			),
			OriginalAmount:     originalAmount(p.Original),
			OriginalInstrument: originalInstrument(p.Original),
			Memo:               p.Memo,
		}
		if p.SettledOn != nil {
			sp.SettledOn = p.SettledOn.Format(time.DateOnly)
		}

		if p.Statement != nil {
			sp.Statement = p.Statement.String()
		}

		sp.StatementID, sp.StatementBasis, sp.CardRole, sp.Installment = p.StatementID, p.StatementBasis, p.CardRole, p.Installment
		s.Postings = append(s.Postings, sp)
	}

	s.Trade, s.Income = toSnapshotTrade(t.Trade), toSnapshotIncome(t.Income)

	return s
}

func toSnapshotTrade(tr *domain.Trade) *snapshotTrade {
	if tr == nil {
		return nil
	}

	st := &snapshotTrade{
		AccountID:     tr.AccountID,
		CashAccountID: tr.CashAccountID,
		Side:          string(tr.Side),
		Quantity:      tr.Quantity.Amount(),
		Instrument:    string(tr.Quantity.Currency()),
		UnitPrice:     tr.UnitPrice.String(),
		Gross:         tr.Gross.Amount(),
		Fees:          tr.Fees.Amount(),
		Taxes:         tr.Taxes.Amount(),
		Currency:      string(tr.Gross.Currency()),
	}
	if tr.Cost != nil {
		c := tr.Cost.Amount()
		st.Cost = &c
	}

	return st
}

func toSnapshotIncome(in *domain.Income) *snapshotIncome {
	if in == nil {
		return nil
	}

	return &snapshotIncome{
		AccountID:     in.AccountID,
		CashAccountID: in.CashAccountID,
		Type:          string(in.Type),
		Gross:         in.Gross.Amount(),
		Withheld:      in.Withheld.Amount(),
		Currency:      string(in.Gross.Currency()),
	}
}

func (s snapshot) transaction(
	ctx context.Context,
	ins app.Instruments,
) (domain.Transaction, error) {
	d, err := time.Parse(time.DateOnly, s.Date)
	if err != nil {
		return domain.Transaction{}, err
	}

	t := domain.Transaction{
		ID:          s.ID,
		BooksID:     s.BooksID,
		Date:        d,
		Description: s.Description,
		PayeeID:     s.PayeeID,
		BalancingCurrency: money.Currency(
			s.BalancingCurrency,
		),
		Origin:  domain.Origin(s.Origin),
		Version: s.Version,
		Tags:    s.Tags,
	}
	for _, l := range s.Links {
		t.Links = append(
			t.Links,
			domain.Link{Type: domain.LinkType(l.Type), Target: l.Target, Amount: l.Amount},
		)
	}

	for _, sp := range s.Postings {
		p, err := sp.posting(ctx, ins, t.BalancingCurrency)
		if err != nil {
			return domain.Transaction{}, err
		}

		t.Postings = append(t.Postings, p)
	}

	if t.Trade, err = s.Trade.trade(ctx, ins); err != nil {
		return domain.Transaction{}, err
	}

	t.Income, err = s.Income.income()

	return t, err
}

func (st *snapshotTrade) trade(ctx context.Context, ins app.Instruments) (*domain.Trade, error) {
	if st == nil {
		return nil, nil
	}

	quantity, err := app.AmountOf(ctx, ins, st.Quantity, money.Currency(st.Instrument))
	if err != nil {
		return nil, err
	}

	price, err := money.ParseRate(st.UnitPrice)
	if err != nil {
		return nil, err
	}

	tr := &domain.Trade{
		AccountID:     st.AccountID,
		CashAccountID: st.CashAccountID,
		Side:          domain.Side(st.Side),
		Quantity:      quantity,
		UnitPrice:     price,
	}

	cur := money.Currency(st.Currency)
	for _, x := range []struct {
		to *money.Money
		v  int64
	}{{&tr.Gross, st.Gross}, {&tr.Fees, st.Fees}, {&tr.Taxes, st.Taxes}} {
		if *x.to, err = money.New(x.v, cur); err != nil {
			return nil, err
		}
	}

	if st.Cost != nil {
		cost, err := money.New(*st.Cost, cur)
		if err != nil {
			return nil, err
		}

		tr.Cost = &cost
	}

	return tr, nil
}

func (si *snapshotIncome) income() (*domain.Income, error) {
	if si == nil {
		return nil, nil
	}

	cur := money.Currency(si.Currency)

	gross, err := money.New(si.Gross, cur)
	if err != nil {
		return nil, err
	}

	withheld, err := money.New(si.Withheld, cur)
	if err != nil {
		return nil, err
	}

	return &domain.Income{
		AccountID:     si.AccountID,
		CashAccountID: si.CashAccountID,
		Type:          domain.IncomeType(si.Type),
		Gross:         gross,
		Withheld:      withheld,
	}, nil
}

func (sp snapshotPosting) posting(
	ctx context.Context,
	ins app.Instruments,
	balancing money.Currency,
) (domain.Posting, error) {
	amount, err := app.AmountOf(ctx, ins, sp.Amount, money.Currency(sp.Currency))
	if err != nil {
		return domain.Posting{}, err
	}

	weight, err := money.New(sp.Weight, balancing)
	if err != nil {
		return domain.Posting{}, err
	}

	p := domain.Posting{
		AccountID:      sp.AccountID,
		Amount:         amount,
		Weight:         weight,
		Status:         domain.PostingStatus(sp.Status),
		Memo:           sp.Memo,
		StatementID:    sp.StatementID,
		StatementBasis: sp.StatementBasis,
		CardRole:       sp.CardRole,
		Installment:    sp.Installment,
	}
	if sp.Statement != "" {
		m, err := domain.ParseReferenceMonth(sp.Statement)
		if err != nil {
			return domain.Posting{}, err
		}

		p.Statement = &m
	}

	if sp.SettledOn != "" {
		settled, err := time.Parse(time.DateOnly, sp.SettledOn)
		if err != nil {
			return domain.Posting{}, err
		}

		p.SettledOn = &settled
	}

	if sp.OriginalAmount != nil && sp.OriginalInstrument != nil {
		orig, err := money.New(*sp.OriginalAmount, money.Currency(*sp.OriginalInstrument))
		if err != nil {
			return domain.Posting{}, err
		}

		p.Original = &orig
	}

	return p, nil
}
