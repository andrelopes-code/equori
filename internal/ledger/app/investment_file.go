package app

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// errDryRun leaves the transaction of a dry run so the database rolls back what it recorded.
var errDryRun = errors.New("dry run")

// InvestmentFile is a file of openings, trades and incomes for one brokerage (investment history
// IF1). CashAccountID and CategoryID are empty when the file needs none or takes the default.
type InvestmentFile struct {
	BrokerageID, CashAccountID, CategoryID uuid.UUID
	Content                                []byte
	DryRun                                 bool
}

// InvestmentFileResult counts the lines of a file, the lines recorded and the lines equal to a
// recorded transaction.
type InvestmentFileResult struct {
	Lines, Created, Skipped int
}

// fileRun holds what the lines of one import share.
type fileRun struct {
	orders   domain.FileOrders
	holdings map[money.Currency]uuid.UUID
	trades   []TradeFact
	incomes  []IncomeFact
	used     map[uuid.UUID]bool
}

// ImportInvestmentFile records the lines of f in date order, lines of one date in file order,
// in one database transaction (IF5). A line equal to a recorded transaction is skipped (IF6). A
// dry run records inside the transaction and rolls it back, so a sale sees the lines before it
// (IF8).
func (s *Service) ImportInvestmentFile(
	ctx context.Context,
	booksID int64,
	f InvestmentFile,
) (InvestmentFileResult, error) {
	lines, err := domain.ParseInvestmentFile(f.Content)
	if err != nil {
		return InvestmentFileResult{}, err
	}

	slices.SortStableFunc(lines, func(a, b domain.FileLine) int { return a.Date.Compare(b.Date) })

	var out InvestmentFileResult

	err = s.repo.InTx(ctx, func(r Repository) error {
		var err error

		out, err = s.importLines(ctx, r, booksID, f, lines)
		if err != nil || !f.DryRun {
			return err
		}

		return errDryRun
	})
	if errors.Is(err, errDryRun) {
		return out, nil
	}

	if err != nil {
		return InvestmentFileResult{}, err
	}

	return out, nil
}

func (s *Service) importLines(
	ctx context.Context,
	r Repository,
	booksID int64,
	f InvestmentFile,
	lines []domain.FileLine,
) (InvestmentFileResult, error) {
	run, err := s.newFileRun(ctx, r, booksID, f, lines)
	if err != nil {
		return InvestmentFileResult{}, err
	}

	out := InvestmentFileResult{Lines: len(lines)}

	for _, l := range lines {
		skipped, err := s.importLine(ctx, r, booksID, run, l)
		if err != nil {
			return InvestmentFileResult{}, lineError(l.Line, err)
		}

		if skipped {
			out.Skipped++
		} else {
			out.Created++
		}
	}

	return out, nil
}

// newFileRun checks the brokerage, the category and the cash the lines need (IF7), and reads the
// transactions the lines are matched against (IF6).
func (s *Service) newFileRun(
	ctx context.Context,
	r Repository,
	booksID int64,
	f InvestmentFile,
	lines []domain.FileLine,
) (*fileRun, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return nil, err
	}

	if _, err := r.Account(ctx, booksID, f.BrokerageID); err != nil {
		return nil, err
	}

	brokerage, err := s.lockBrokerage(ctx, r, booksID, f.BrokerageID)
	if err != nil {
		return nil, err
	}

	run := &fileRun{
		orders: domain.FileOrders{
			BrokerageID: f.BrokerageID, CashAccountID: f.CashAccountID, CategoryID: f.CategoryID,
			Base: base, Cash: base,
		},
		holdings: map[money.Currency]uuid.UUID{}, used: map[uuid.UUID]bool{},
	}

	if f.CategoryID == uuid.Nil && slices.ContainsFunc(lines, isKind("income")) {
		return nil, fieldErr("category_id", "is required by the income lines", domain.ErrValidation)
	}

	if slices.ContainsFunc(lines, needsCash) {
		if err := fileCash(ctx, r, brokerage, run); err != nil {
			return nil, err
		}
	}

	return run, s.readRecorded(ctx, r, brokerage, run)
}

// fileCash sets the cash account of the import, the default one when the file names none, and the
// currency of the amounts of the lines that settle in it (foreign cash FC10).
func fileCash(
	ctx context.Context,
	r Repository,
	brokerage domain.Account,
	run *fileRun,
) error {
	if run.orders.CashAccountID == uuid.Nil {
		id, err := defaultCash(ctx, r, brokerage, run.orders.Base)
		run.orders.CashAccountID = id

		return err
	}

	cash, err := loadAccount(ctx, r, brokerage.BooksID, run.orders.CashAccountID, "cash_account_id")
	run.orders.Cash = cash.Instrument

	return err
}

// readRecorded loads the holdings of the brokerage and their recorded trades and incomes.
func (s *Service) readRecorded(
	ctx context.Context,
	r Repository,
	brokerage domain.Account,
	run *fileRun,
) error {
	children, err := r.ChildAccounts(ctx, brokerage.BooksID, brokerage.ID)
	if err != nil {
		return err
	}

	var ids []uuid.UUID

	for _, c := range children {
		if c.HoldsSecurity() {
			run.holdings[c.Instrument] = c.ID
			ids = append(ids, c.ID)
		}
	}

	if len(ids) == 0 {
		return nil
	}

	if run.trades, err = r.SecurityTrades(ctx, brokerage.BooksID, ids); err != nil {
		return err
	}

	run.incomes, err = r.SecurityIncomes(ctx, brokerage.BooksID, ids)

	return err
}

// importLine records l, or reports that a recorded transaction equals it.
func (s *Service) importLine(
	ctx context.Context,
	r Repository,
	booksID int64,
	run *fileRun,
	l domain.FileLine,
) (skipped bool, err error) {
	code, scale, quote, err := s.fileInstrument(ctx, booksID, l.Instrument)
	if err != nil {
		return false, err
	}

	if l.Kind == "income" {
		return s.importIncome(ctx, r, booksID, run, l, code)
	}

	o, err := run.orders.Trade(l, code, scale, quote)
	if err != nil {
		return false, err
	}

	if run.matchTrade(o) {
		return true, nil
	}

	_, err = s.recordTrade(ctx, r, booksID, o, run.orders.Base)

	return false, err
}

func (s *Service) importIncome(
	ctx context.Context,
	r Repository,
	booksID int64,
	run *fileRun,
	l domain.FileLine,
	code money.Currency,
) (skipped bool, err error) {
	o, err := run.orders.Income(l, code)
	if err != nil {
		return false, err
	}

	if run.matchIncome(o) {
		return true, nil
	}

	_, err = s.recordIncome(ctx, r, booksID, o)

	return false, err
}

// fileInstrument returns the code, the scale and the quote currency of a defined instrument (IF4).
func (s *Service) fileInstrument(
	ctx context.Context,
	booksID int64,
	code money.Currency,
) (money.Currency, int, money.Currency, error) {
	if s.ins == nil {
		return "", 0, "", undefinedInstrument()
	}

	resolved, err := s.ins.ResolveCode(ctx, code)
	if err != nil && !errors.Is(err, ErrUnknownInstrument) {
		return "", 0, "", err
	}

	if err == nil {
		code = resolved
	}

	in, err := s.ins.Instrument(ctx, code)
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && !visibleTo(in, booksID)) {
		return "", 0, "", undefinedInstrument()
	}

	return code, in.Scale, in.QuoteCurrency, err
}

// matchTrade reports whether a recorded trade equals o and marks it as answered (IF6).
func (run *fileRun) matchTrade(o domain.TradeOrder) bool {
	account, ok := run.holdings[o.Instrument]
	if !ok {
		return false
	}

	i := slices.IndexFunc(run.trades, func(f TradeFact) bool {
		fees, ok := run.inBase(o.Fees, o.ExchangeRate, f.ExchangeRate)

		return ok && !run.used[f.TransactionID] && f.AccountID == account &&
			f.Side == string(o.Side) && f.Date.Equal(o.Date) &&
			f.Quantity == o.Quantity.Amount() && f.Fees == fees &&
			f.UnitPrice.Reduced() == o.UnitPrice.Reduced()
	})
	if i < 0 {
		return false
	}

	run.used[run.trades[i].TransactionID] = true

	return true
}

// matchIncome reports whether a recorded income equals o and marks it as answered (IF6).
func (run *fileRun) matchIncome(o domain.IncomeOrder) bool {
	account, ok := run.holdings[o.Instrument]
	if !ok {
		return false
	}

	i := slices.IndexFunc(run.incomes, func(f IncomeFact) bool {
		gross, ok := run.inBase(&o.Gross, o.ExchangeRate, f.ExchangeRate)

		return ok && !run.used[f.TransactionID] && f.AccountID == account &&
			f.Type == string(o.Type) && f.Date.Equal(o.Date) && f.Gross == gross
	})
	if i < 0 {
		return false
	}

	run.used[run.incomes[i].TransactionID] = true

	return true
}

// inBase returns m, an amount of the cash currency of a line, in the base currency at the rate
// recorded with the transaction the line is matched against (foreign cash FC10). It is not
// comparable when the line gives a rate other than the recorded one.
func (run *fileRun) inBase(m *money.Money, given, recorded *money.Rate) (int64, bool) {
	if given != nil && (recorded == nil || given.Reduced() != recorded.Reduced()) {
		return 0, false
	}

	switch {
	case m == nil:
		return 0, true
	case recorded == nil:
		return m.Amount(), true
	}

	converted, err := money.Convert(*m, run.orders.Base, money.Leg{Rate: *recorded})

	return converted.Amount(), err == nil
}

func undefinedInstrument() error {
	return fieldErr(
		"instrument", "is not defined; define it on Instruments first", domain.ErrValidation,
	)
}

func visibleTo(in Instrument, booksID int64) bool {
	return in.BooksID == 0 || in.BooksID == booksID
}

func lineError(line int, err error) error {
	fe, ok := errors.AsType[*domain.FieldError](err)
	if !ok {
		return err
	}

	return &domain.FieldError{
		Field:   fmt.Sprintf("line %d", line),
		Message: fe.Field + " " + fe.Message,
		Err:     fe.Err,
	}
}

func isKind(kind string) func(domain.FileLine) bool {
	return func(l domain.FileLine) bool { return l.Kind == kind }
}

func needsCash(l domain.FileLine) bool { return l.Kind != "opening" }
