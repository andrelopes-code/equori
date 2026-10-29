package postgres

import (
	"cmp"
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

// SQLSTATE codes mapped to domain errors.
const (
	foreignKeyViolation = "23503"
	uniqueViolation     = "23505"
)

var _ app.Repository = (*Repository)(nil)

// db is satisfied by *pgxpool.Pool and pgx.Tx (ADR 005).
type db interface {
	DBTX
	Begin(ctx context.Context) (pgx.Tx, error)
}

type Repository struct {
	db  db
	q   *Queries
	tx  pgx.Tx
	ins app.Instruments
}

// NewRepository reads amounts of securities with the scales of ins; nil serves currencies only.
func NewRepository(db db, ins app.Instruments) *Repository {
	r := &Repository{db: db, q: New(db), ins: ins}
	if tx, ok := db.(pgx.Tx); ok {
		r.tx = tx
	}
	return r
}

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		return fn(&Repository{db: tx, q: r.q.WithTx(tx), tx: tx, ins: r.ins})
	})
}

func (r *Repository) Publish(ctx context.Context, e outbox.Event) error {
	if r.tx == nil {
		return errors.New("publish outside a transaction")
	}
	return outbox.Insert(ctx, r.tx, e)
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}
	return err
}

func (r *Repository) Settings(ctx context.Context, userID int64) (app.Settings, error) {
	row, err := r.q.GetSettings(ctx, userID)
	if err != nil {
		return app.Settings{}, notFound(err)
	}
	return app.Settings{UserID: row.UserID, BaseCurrency: money.Currency(row.BaseCurrency)}, nil
}

func (r *Repository) SaveSettings(ctx context.Context, s app.Settings) error {
	return r.q.UpsertSettings(ctx, UpsertSettingsParams{UserID: s.UserID, BaseCurrency: string(s.BaseCurrency)})
}

func (r *Repository) SetSystemAccountsInstrument(ctx context.Context, userID int64, c money.Currency) error {
	return r.q.SetSystemAccountsInstrument(ctx, SetSystemAccountsInstrumentParams{UserID: userID, Instrument: string(c)})
}

func (r *Repository) CountTransactions(ctx context.Context, userID int64) (int64, error) {
	return r.q.CountTransactions(ctx, userID)
}

func (r *Repository) InsertInstitution(ctx context.Context, i app.Institution) (app.Institution, error) {
	row, err := r.q.InsertInstitution(ctx, InsertInstitutionParams{UserID: i.UserID, Name: i.Name, Code: nullString(i.Code), IdentifierScheme: nullString(i.Identifier.Scheme), Identifier: nullString(i.Identifier.Value)})
	if err != nil {
		return app.Institution{}, duplicateInstitution(err)
	}
	return toInstitution(row), nil
}

func (r *Repository) SetInstitutionIdentifier(ctx context.Context, userID int64, id uuid.UUID, ident app.InstitutionIdentifier) (app.Institution, error) {
	row, err := r.q.SetInstitutionIdentifier(ctx, SetInstitutionIdentifierParams{UserID: userID, ID: id, IdentifierScheme: nullString(ident.Scheme), Identifier: nullString(ident.Value)})
	if err != nil {
		return app.Institution{}, duplicateInstitution(notFound(err))
	}
	return toInstitution(row), nil
}

// duplicateInstitution names the field of the unique index an institution violated.
func duplicateInstitution(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.ConstraintName == "ledger_institution_identifier_key" {
		return duplicate(err, "identifier")
	}
	return duplicate(err, "name")
}

func (r *Repository) ListInstitutions(ctx context.Context, userID int64, p page.Request[app.InstitutionKey]) ([]app.Institution, *app.InstitutionKey, error) {
	params := ListInstitutionsParams{UserID: userID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterName, params.AfterID = &p.After.Name, nullUUID(p.After.ID)
	}
	rows, err := r.q.ListInstitutions(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	items, next := pageOf(rows, p.Limit,
		func(row ListInstitutionsRow) app.Institution {
			return toInstitution(LedgerInstitution{ID: row.ID, UserID: row.UserID, Name: row.Name, Code: row.Code, IdentifierScheme: row.IdentifierScheme, Identifier: row.Identifier})
		},
		func(row ListInstitutionsRow) app.InstitutionKey {
			return app.InstitutionKey{Name: row.SortName, ID: row.ID}
		})
	return items, next, nil
}

func (r *Repository) InsertPayee(ctx context.Context, p app.Payee) (app.Payee, error) {
	row, err := r.q.InsertPayee(ctx, InsertPayeeParams{UserID: p.UserID, Name: p.Name})
	if err != nil {
		return app.Payee{}, duplicate(err, "name")
	}
	return toPayee(row), nil
}

func (r *Repository) RenamePayee(ctx context.Context, userID int64, id uuid.UUID, name string) (app.Payee, error) {
	row, err := r.q.RenamePayee(ctx, RenamePayeeParams{UserID: userID, ID: id, Name: name})
	if err != nil {
		return app.Payee{}, duplicate(notFound(err), "name")
	}
	return toPayee(row), nil
}

func (r *Repository) TransactionsWithPayee(ctx context.Context, userID int64, payeeID uuid.UUID) ([]uuid.UUID, error) {
	return r.q.TransactionsWithPayee(ctx, TransactionsWithPayeeParams{UserID: userID, PayeeID: nullUUID(payeeID)})
}

func (r *Repository) TagUsage(ctx context.Context, userID int64, name string) (app.TagUsage, error) {
	row, err := r.q.GetTagUsage(ctx, GetTagUsageParams{UserID: userID, Name: name})
	if err != nil {
		return app.TagUsage{}, notFound(err)
	}
	return app.TagUsage{ID: row.ID, Name: row.Name, Transactions: int(row.Transactions)}, nil
}

func (r *Repository) RenameTag(ctx context.Context, userID int64, id uuid.UUID, name string) error {
	_, err := r.q.RenameTag(ctx, RenameTagParams{UserID: userID, ID: id, NewName: name})
	return duplicate(notFound(err), "name")
}

func (r *Repository) TransactionsWithTag(ctx context.Context, userID int64, tagID uuid.UUID) ([]uuid.UUID, error) {
	return r.q.TransactionsWithTag(ctx, TransactionsWithTagParams{UserID: userID, TagID: tagID})
}

func (r *Repository) MoveTagLinks(ctx context.Context, userID int64, from, into uuid.UUID) error {
	return r.q.MoveTagLinks(ctx, MoveTagLinksParams{UserID: userID, FromID: from, IntoID: into})
}

func (r *Repository) DeleteTag(ctx context.Context, userID int64, id uuid.UUID) error {
	return r.q.DeleteTag(ctx, DeleteTagParams{UserID: userID, ID: id})
}

func (r *Repository) RetirePayee(ctx context.Context, userID int64, from, into uuid.UUID) error {
	if err := r.q.MoveVoidedPayee(ctx, MoveVoidedPayeeParams{UserID: userID, FromID: nullUUID(from), IntoID: nullUUID(into)}); err != nil {
		return err
	}
	if err := r.q.MoveCounterpartyPayee(ctx, MoveCounterpartyPayeeParams{UserID: userID, FromID: nullUUID(from), IntoID: nullUUID(into)}); err != nil {
		return err
	}
	return r.q.MarkPayeeMerged(ctx, MarkPayeeMergedParams{UserID: userID, FromID: from, IntoID: nullUUID(into)})
}

func (r *Repository) Payee(ctx context.Context, userID int64, id uuid.UUID) (app.Payee, error) {
	row, err := r.q.GetPayee(ctx, GetPayeeParams{UserID: userID, ID: id})
	if err != nil {
		return app.Payee{}, notFound(err)
	}
	return toPayee(row), nil
}

func (r *Repository) PayeeNames(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	rows, err := r.q.PayeeNames(ctx, PayeeNamesParams{UserID: userID, Ids: ids})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		out[row.ID] = row.Name
	}
	return out, nil
}

func (r *Repository) ListPayees(ctx context.Context, userID int64, p page.Request[app.PayeeKey]) ([]app.Payee, *app.PayeeKey, error) {
	params := ListPayeesParams{UserID: userID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterName, params.AfterID = &p.After.Name, nullUUID(p.After.ID)
	}
	rows, err := r.q.ListPayees(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	items, next := pageOf(rows, p.Limit,
		func(row ListPayeesRow) app.Payee {
			return toPayee(LedgerPayee{ID: row.ID, UserID: row.UserID, Name: row.Name})
		},
		func(row ListPayeesRow) app.PayeeKey { return app.PayeeKey{Name: row.SortName, ID: row.ID} })
	return items, next, nil
}

func (r *Repository) ListTags(ctx context.Context, userID int64, p page.Request[app.TagKey]) ([]string, *app.TagKey, error) {
	params := ListTagsParams{UserID: userID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterName = &p.After.Name
	}
	rows, err := r.q.ListTags(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	items, next := pageOf(rows, p.Limit, func(name string) string { return name }, func(name string) app.TagKey { return app.TagKey{Name: name} })
	return items, next, nil
}

func (r *Repository) Account(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error) {
	row, err := r.q.GetAccount(ctx, GetAccountParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Account{}, notFound(err)
	}
	return toAccount(row), nil
}

func (r *Repository) Accounts(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]domain.Account, error) {
	rows, err := r.q.GetAccountsByIDs(ctx, GetAccountsByIDsParams{UserID: userID, Ids: ids})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]domain.Account, len(rows))
	for _, row := range rows {
		out[row.ID] = toAccount(row)
	}
	return out, nil
}

func (r *Repository) ListAccounts(ctx context.Context, userID int64, p page.Request[app.AccountKey]) ([]domain.Account, *app.AccountKey, error) {
	params := ListAccountsParams{UserID: userID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterClass, params.AfterName, params.AfterID = &p.After.Class, &p.After.Name, nullUUID(p.After.ID)
	}
	rows, err := r.q.ListAccounts(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	items, next := pageOf(rows, p.Limit,
		func(row ListAccountsRow) domain.Account {
			return toAccount(LedgerAccount{
				ID: row.ID, UserID: row.UserID, Name: row.Name, AccountClass: row.AccountClass, Kind: row.Kind,
				Instrument: row.Instrument, ParentID: row.ParentID, InstitutionID: row.InstitutionID,
				CounterpartyPayeeID: row.CounterpartyPayeeID, OpenedOn: row.OpenedOn, ClosedOn: row.ClosedOn,
				YieldMode: row.YieldMode, SystemRole: row.SystemRole, Color: row.Color, Icon: row.Icon,
				ExcludedFromLiquidity: row.ExcludedFromLiquidity,
				CreatedAt:             row.CreatedAt, UpdatedAt: row.UpdatedAt,
			})
		},
		func(row ListAccountsRow) app.AccountKey {
			return app.AccountKey{Class: row.AccountClass, Name: row.SortName, ID: row.ID}
		})
	return items, next, nil
}

func (r *Repository) InsertAccount(ctx context.Context, a domain.Account) (domain.Account, error) {
	row, err := r.q.InsertAccount(ctx, InsertAccountParams{
		UserID: a.UserID, Name: a.Name, AccountClass: string(a.Class), Kind: nullString(string(a.Kind)),
		Instrument: string(a.Instrument), ParentID: nullUUID(a.ParentID), InstitutionID: nullUUID(a.InstitutionID),
		CounterpartyPayeeID: nullUUID(a.CounterpartyID), OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn,
		YieldMode: string(a.YieldMode), SystemRole: nullString(string(a.SystemRole)),
		Color: nullColor(a.Color), Icon: nullString(a.Icon),
	})
	if err != nil {
		return domain.Account{}, referenceError(err)
	}
	return toAccount(row), nil
}

func (r *Repository) UpdateAccount(ctx context.Context, a domain.Account) (domain.Account, error) {
	row, err := r.q.UpdateAccount(ctx, UpdateAccountParams{
		UserID: a.UserID, ID: a.ID, Name: a.Name, ParentID: nullUUID(a.ParentID),
		InstitutionID: nullUUID(a.InstitutionID), ClosedOn: a.ClosedOn, YieldMode: string(a.YieldMode),
		Color: nullColor(a.Color), Icon: nullString(a.Icon), ExcludedFromLiquidity: a.ExcludedFromLiquidity,
	})
	if err != nil {
		return domain.Account{}, referenceError(notFound(err))
	}
	return toAccount(row), nil
}

func (r *Repository) AccountHasChildren(ctx context.Context, userID int64, id uuid.UUID) (bool, error) {
	return r.q.AccountHasChildren(ctx, AccountHasChildrenParams{UserID: userID, ParentID: nullUUID(id)})
}

func (r *Repository) AccountTotals(ctx context.Context, userID int64, id uuid.UUID) (app.AccountTotals, error) {
	row, err := r.q.AccountTotals(ctx, AccountTotalsParams{UserID: userID, AccountID: id})
	if err != nil {
		return app.AccountTotals{}, err
	}
	return app.AccountTotals{Total: row.Total, LastBookedOn: row.LastBookedOn}, nil
}

func (r *Repository) AccountTransactionsBetween(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]uuid.UUID, error) {
	return r.q.AccountTransactionsBetween(ctx, AccountTransactionsBetweenParams{UserID: userID, AccountID: accountID, FromDate: from, ToDate: to})
}

func (r *Repository) TransactionsWithAccount(ctx context.Context, userID int64, accountID uuid.UUID) ([]uuid.UUID, error) {
	return r.q.TransactionsWithAccount(ctx, TransactionsWithAccountParams{UserID: userID, AccountID: accountID})
}

func (r *Repository) Transaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error) {
	row, err := r.q.GetTransaction(ctx, GetTransactionParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Transaction{}, notFound(err)
	}
	return r.complete(ctx, userID, row)
}

func (r *Repository) LockTransaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error) {
	row, err := r.q.GetTransactionForUpdate(ctx, GetTransactionForUpdateParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Transaction{}, notFound(err)
	}
	return r.complete(ctx, userID, row)
}

func (r *Repository) complete(ctx context.Context, userID int64, row LedgerTransaction) (domain.Transaction, error) {
	ts, err := r.completeAll(ctx, userID, []LedgerTransaction{row})
	if err != nil {
		return domain.Transaction{}, err
	}
	return ts[0], nil
}

// completeAll loads postings, tags and links of rows in three queries.
func (r *Repository) completeAll(ctx context.Context, userID int64, rows []LedgerTransaction) ([]domain.Transaction, error) {
	ids := make([]uuid.UUID, len(rows))
	byID := make(map[uuid.UUID]*domain.Transaction, len(rows))
	out := make([]domain.Transaction, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = toTransaction(row)
		byID[row.ID] = &out[i]
	}
	postings, err := r.q.ListPostings(ctx, ListPostingsParams{UserID: userID, TransactionIds: ids})
	if err != nil {
		return nil, err
	}
	for _, p := range postings {
		posting, err := r.toPosting(ctx, p)
		if err != nil {
			return nil, err
		}
		t := byID[p.TransactionID]
		t.Postings = append(t.Postings, posting)
	}
	tags, err := r.q.ListTransactionTags(ctx, ListTransactionTagsParams{UserID: userID, TransactionIds: ids})
	if err != nil {
		return nil, err
	}
	for _, tag := range tags {
		t := byID[tag.TransactionID]
		t.Tags = append(t.Tags, tag.Name)
	}
	links, err := r.q.ListLinksFrom(ctx, ListLinksFromParams{UserID: userID, TransactionIds: ids})
	if err != nil {
		return nil, err
	}
	for _, l := range links {
		t := byID[l.FromTransactionID]
		t.Links = append(t.Links, domain.Link{Type: domain.LinkType(l.LinkType), Target: l.ToTransactionID, Amount: storedAmount(l.Amount)})
	}
	trades, err := r.q.ListTrades(ctx, ListTradesParams{UserID: userID, TransactionIds: ids})
	if err != nil {
		return nil, err
	}
	for _, row := range trades {
		trade, err := r.toTrade(ctx, row, byID[row.TransactionID])
		if err != nil {
			return nil, err
		}
		byID[row.TransactionID].Trade = &trade
	}
	incomes, err := r.q.ListInvestmentIncome(ctx, ListInvestmentIncomeParams{UserID: userID, TransactionIds: ids})
	if err != nil {
		return nil, err
	}
	for _, row := range incomes {
		cur := money.Currency(row.Currency)
		gross, err := money.New(row.Gross, cur)
		if err != nil {
			return nil, err
		}
		withheld, err := money.New(row.Withheld, cur)
		if err != nil {
			return nil, err
		}
		byID[row.TransactionID].Income = &domain.Income{
			AccountID: row.AccountID, CashAccountID: row.CashAccountID, Type: domain.IncomeType(row.IncomeType), Gross: gross, Withheld: withheld,
		}
	}
	return out, nil
}

func (r *Repository) InsertTransaction(ctx context.Context, t domain.Transaction) (domain.Transaction, error) {
	if err := r.InsertTransactionRows(ctx, t); err != nil {
		return domain.Transaction{}, err
	}
	return r.Transaction(ctx, t.UserID, t.ID)
}

func (r *Repository) InsertTransactionRows(ctx context.Context, t domain.Transaction) error {
	_, err := r.q.InsertTransaction(ctx, InsertTransactionParams{
		ID: t.ID, UserID: t.UserID, Date: t.Date, Description: t.Description, PayeeID: nullUUID(t.PayeeID),
		BalancingCurrency: string(t.BalancingCurrency), Origin: string(t.Origin), Version: int32(t.Version), //nolint:gosec // version is a small positive counter.
	})
	if err != nil {
		return referenceError(err)
	}
	if err := r.writeChildren(ctx, t); err != nil {
		return err
	}
	if in := t.Income; in != nil {
		return r.q.InsertInvestmentIncome(ctx, InsertInvestmentIncomeParams{
			TransactionID: t.ID, UserID: t.UserID, AccountID: in.AccountID, CashAccountID: in.CashAccountID, IncomeType: string(in.Type),
			Gross: in.Gross.Amount(), Withheld: in.Withheld.Amount(), Currency: string(in.Gross.Currency()),
		})
	}
	if tr := t.Trade; tr != nil {
		var cost *int64
		if tr.Cost != nil {
			c := tr.Cost.Amount()
			cost = &c
		}
		return r.q.InsertTrade(ctx, InsertTradeParams{
			TransactionID: t.ID, UserID: t.UserID, AccountID: tr.AccountID, CashAccountID: tr.CashAccountID, Side: string(tr.Side),
			Quantity: tr.Quantity.Amount(), UnitPrice: platformpg.NumericOf(tr.UnitPrice), Gross: tr.Gross.Amount(),
			Fees: tr.Fees.Amount(), Taxes: tr.Taxes.Amount(), Cost: cost, Currency: string(tr.Gross.Currency()),
		})
	}
	return nil
}

func (r *Repository) toTrade(ctx context.Context, row LedgerTrade, t *domain.Transaction) (domain.Trade, error) {
	var instrument money.Currency
	for _, p := range t.Postings {
		if p.AccountID == row.AccountID {
			instrument = p.Amount.Currency()
		}
	}
	quantity, err := app.AmountOf(ctx, r.ins, row.Quantity, instrument)
	if err != nil {
		return domain.Trade{}, fmt.Errorf("trade %s quantity: %w", row.TransactionID, err)
	}
	price, err := platformpg.RateOf(row.UnitPrice)
	if err != nil {
		return domain.Trade{}, err
	}
	cur := money.Currency(row.Currency)
	amounts := make([]money.Money, 3)
	for i, v := range []int64{row.Gross, row.Fees, row.Taxes} {
		if amounts[i], err = money.New(v, cur); err != nil {
			return domain.Trade{}, err
		}
	}
	trade := domain.Trade{
		AccountID: row.AccountID, CashAccountID: row.CashAccountID, Side: domain.Side(row.Side), Quantity: quantity, UnitPrice: price,
		Gross: amounts[0], Fees: amounts[1], Taxes: amounts[2],
	}
	if row.Cost != nil {
		cost, err := money.New(*row.Cost, cur)
		if err != nil {
			return domain.Trade{}, err
		}
		trade.Cost = &cost
	}
	return trade, nil
}

func (r *Repository) SecurityPostings(ctx context.Context, userID int64, accountIDs []uuid.UUID) ([]app.HoldingPosting, error) {
	rows, err := r.q.SecurityPostings(ctx, SecurityPostingsParams{UserID: userID, AccountIds: accountIDs})
	return mapAll(rows, func(row SecurityPostingsRow) app.HoldingPosting {
		return app.HoldingPosting{AccountID: row.AccountID, TransactionID: row.TransactionID, Date: row.BookedOn, Quantity: row.Amount, Weight: row.Weight}
	}), err
}

func (r *Repository) SecurityTrades(ctx context.Context, userID int64, accountIDs []uuid.UUID) ([]app.TradeFact, error) {
	rows, err := r.q.SecurityTrades(ctx, SecurityTradesParams{UserID: userID, AccountIds: accountIDs})
	return mapAll(rows, func(row SecurityTradesRow) app.TradeFact {
		f := app.TradeFact{
			TransactionID: row.TransactionID, AccountID: row.AccountID, Date: row.Date, Side: row.Side,
			Quantity: row.Quantity, Gross: row.Gross, Fees: row.Fees, Taxes: row.Taxes,
		}
		if row.Cost != nil {
			f.Cost = *row.Cost
		}
		return f
	}), err
}

func (r *Repository) SecurityIncomes(ctx context.Context, userID int64, accountIDs []uuid.UUID) ([]app.IncomeFact, error) {
	rows, err := r.q.SecurityIncomes(ctx, SecurityIncomesParams{UserID: userID, AccountIds: accountIDs})
	return mapAll(rows, func(row SecurityIncomesRow) app.IncomeFact {
		return app.IncomeFact{TransactionID: row.TransactionID, AccountID: row.AccountID, Date: row.Date, Type: row.IncomeType, Gross: row.Gross, Withheld: row.Withheld}
	}), err
}

func (r *Repository) Holding(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time) (int64, int64, error) {
	row, err := r.q.Holding(ctx, HoldingParams{UserID: userID, AccountID: accountID, OnDate: date})
	return row.Quantity, row.CostBasis, err
}

func (r *Repository) LaterSaleExists(ctx context.Context, userID int64, accountIDs []uuid.UUID, date time.Time, exclude uuid.UUID) (bool, error) {
	return r.q.LaterSaleExists(ctx, LaterSaleExistsParams{UserID: userID, AccountIds: accountIDs, OnDate: date, Exclude: exclude})
}

func (r *Repository) ReplaceTransaction(ctx context.Context, prev, next domain.Transaction, reason string) error {
	snapshot, err := json.Marshal(toSnapshot(prev))
	if err != nil {
		return err
	}
	if err := r.q.InsertVersion(ctx, InsertVersionParams{
		TransactionID: prev.ID, Version: int32(prev.Version), Snapshot: snapshot, Reason: reason, //nolint:gosec // version is a small positive counter.
	}); err != nil {
		return err
	}
	if err := r.q.DeletePostings(ctx, prev.ID); err != nil {
		return err
	}
	if err := r.q.DeleteTransactionTags(ctx, prev.ID); err != nil {
		return err
	}
	if err := r.q.DeleteLinksFrom(ctx, prev.ID); err != nil {
		return err
	}
	if err := r.q.UpdateTransaction(ctx, UpdateTransactionParams{
		UserID: next.UserID, ID: next.ID, Date: next.Date, Description: next.Description, PayeeID: nullUUID(next.PayeeID),
		BalancingCurrency: string(next.BalancingCurrency), Origin: string(next.Origin), Version: int32(next.Version), //nolint:gosec // version is a small positive counter.
	}); err != nil {
		return referenceError(err)
	}
	return r.writeChildren(ctx, next)
}

// ReplaceCategoryPostings deletes the postings of prev absent from next and inserts the
// postings of next without an id after the highest position left.
func (r *Repository) ReplaceCategoryPostings(ctx context.Context, prev, next domain.Transaction, reason string) error {
	snapshot, err := json.Marshal(toSnapshot(prev))
	if err != nil {
		return err
	}
	if err := r.q.InsertVersion(ctx, InsertVersionParams{
		TransactionID: prev.ID, Version: int32(prev.Version), Snapshot: snapshot, Reason: reason, //nolint:gosec // version is a small positive counter.
	}); err != nil {
		return err
	}
	var removed []uuid.UUID
	for _, p := range prev.Postings {
		if !slices.ContainsFunc(next.Postings, func(n domain.Posting) bool { return n.ID == p.ID }) {
			removed = append(removed, p.ID)
		}
	}
	if err := r.q.DeletePostingsByID(ctx, DeletePostingsByIDParams{TransactionID: prev.ID, Ids: removed}); err != nil {
		return err
	}
	position, err := r.q.NextPostingPosition(ctx, prev.ID)
	if err != nil {
		return err
	}
	var added []domain.Posting
	for _, p := range next.Postings {
		if p.ID == uuid.Nil {
			added = append(added, p)
		}
	}
	if err := r.insertPostings(ctx, next, added, position); err != nil {
		return err
	}
	if err := r.q.UpdateTransaction(ctx, UpdateTransactionParams{
		UserID: next.UserID, ID: next.ID, Date: next.Date, Description: next.Description, PayeeID: nullUUID(next.PayeeID),
		BalancingCurrency: string(next.BalancingCurrency), Origin: string(next.Origin), Version: int32(next.Version), //nolint:gosec // version is a small positive counter.
	}); err != nil {
		return referenceError(err)
	}
	if err := r.q.DeleteTransactionTags(ctx, prev.ID); err != nil {
		return err
	}
	return r.writeTags(ctx, next)
}

func (r *Repository) writeChildren(ctx context.Context, t domain.Transaction) error {
	if err := r.insertPostings(ctx, t, t.Postings, 0); err != nil {
		return err
	}
	if err := r.writeTags(ctx, t); err != nil {
		return err
	}
	for _, l := range t.Links {
		if err := r.q.InsertLink(ctx, InsertLinkParams{UserID: t.UserID, FromTransactionID: t.ID, ToTransactionID: l.Target, LinkType: string(l.Type), Amount: linkAmount(l.Amount)}); err != nil {
			return referenceError(err)
		}
	}
	return nil
}

// insertPostings writes ps of t at positions from first on.
func (r *Repository) insertPostings(ctx context.Context, t domain.Transaction, ps []domain.Posting, first int16) error {
	postings := make([]InsertPostingsParams, len(ps))
	for i, p := range ps {
		postings[i] = InsertPostingsParams{
			UserID: t.UserID, TransactionID: t.ID, AccountID: p.AccountID, Position: first + int16(i), //nolint:gosec // at most 500 postings (domain.MaxPostings).
			Amount: p.Amount.Amount(), Weight: p.Weight.Amount(), BookedOn: t.Date, SettledOn: p.SettledOn,
			Status: string(p.Status), OriginalAmount: originalAmount(p.Original), OriginalInstrument: originalInstrument(p.Original),
			Memo: nullString(p.Memo), StatementID: nullUUID(p.StatementID), StatementBasis: cmp.Or(p.StatementBasis, domain.BasisDate),
			CardRole:          nullString(p.CardRole),
			InstallmentPlanID: installmentPlan(p.Installment), InstallmentNumber: installmentNumber(p.Installment),
			InstallmentCount: installmentCount(p.Installment), ExternalRecordID: nullUUID(p.ExternalRecordID),
		}
	}
	var postingErr error
	r.q.InsertPostings(ctx, postings).Exec(func(_ int, err error) {
		if err != nil && postingErr == nil {
			postingErr = err
		}
	})
	return referenceError(postingErr)
}

func (r *Repository) writeTags(ctx context.Context, t domain.Transaction) error {
	for _, tag := range t.Tags {
		tagID, err := r.q.UpsertTag(ctx, UpsertTagParams{UserID: t.UserID, Name: tag})
		if err != nil {
			return err
		}
		if err := r.q.InsertTransactionTag(ctx, InsertTransactionTagParams{UserID: t.UserID, TransactionID: t.ID, TagID: tagID}); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) VoidTransaction(ctx context.Context, t domain.Transaction) error {
	return r.q.VoidTransaction(ctx, VoidTransactionParams{UserID: t.UserID, ID: t.ID, VoidedAt: t.VoidedAt, VoidReason: nullString(t.VoidReason)})
}

func (r *Repository) ListTransactions(ctx context.Context, q app.TransactionQuery) ([]domain.Transaction, error) {
	params := ListTransactionsParams{
		UserID: q.UserID, AccountID: nullUUID(q.AccountID), PayeeID: nullUUID(q.PayeeID), Tag: nullString(q.Tag),
		Q: nullString(q.Q), FromDate: q.From, ToDate: q.To, Uncategorized: q.Uncategorized, RowLimit: int32(q.Limit), //nolint:gosec // limit is at most page.MaxLimit + 1.
	}
	if q.After != nil {
		params.AfterDate = &q.After.Date
		params.AfterID = nullUUID(q.After.ID)
	}
	rows, err := r.q.ListTransactions(ctx, params)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return r.completeAll(ctx, q.UserID, rows)
}

func (r *Repository) Versions(ctx context.Context, userID int64, id uuid.UUID) ([]app.Version, error) {
	rows, err := r.q.ListVersions(ctx, ListVersionsParams{UserID: userID, TransactionID: id})
	if err != nil {
		return nil, err
	}
	out := make([]app.Version, len(rows))
	for i, row := range rows {
		var s snapshot
		if err := json.Unmarshal(row.Snapshot, &s); err != nil {
			return nil, fmt.Errorf("decode version %d of %s: %w", row.Version, id, err)
		}
		t, err := s.transaction(ctx, r.ins)
		if err != nil {
			return nil, err
		}
		out[i] = app.Version{Version: int(row.Version), Reason: row.Reason, ReplacedAt: row.ReplacedAt, Transaction: t}
	}
	return out, nil
}

func duplicate(err error, field string) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return &domain.FieldError{Field: field, Message: "already exists", Err: domain.ErrValidation}
	}
	return err
}

// referenceError turns a composite foreign key violation into ErrUnknownAccount: the
// database refused a reference to a row of another user or a missing row (DD3).
func referenceError(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return &domain.FieldError{Field: "reference", Message: "unknown reference: " + pgErr.ConstraintName, Err: domain.ErrUnknownAccount}
	}
	return err
}

func (r *Repository) TreeInstruments(ctx context.Context, userID int64, accountID uuid.UUID) ([]money.Currency, error) {
	rows, err := r.q.TreeInstruments(ctx, TreeInstrumentsParams{UserID: userID, AccountID: accountID})
	out := make([]money.Currency, len(rows))
	for i, c := range rows {
		out[i] = money.Currency(c)
	}
	return out, err
}

func (r *Repository) TreeBalancesByInstrument(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis app.Basis) (map[money.Currency]int64, error) {
	rows, err := r.q.TreeBalancesByInstrument(ctx, TreeBalancesByInstrumentParams{UserID: userID, AccountID: accountID, Settled: basis == app.BasisSettled, OnDate: &date})
	out := make(map[money.Currency]int64, len(rows))
	for _, row := range rows {
		out[money.Currency(row.Instrument)] = row.Total
	}
	return out, err
}

func (r *Repository) TreeExternalFlows(ctx context.Context, userID int64, accountIDs []uuid.UUID, from, to time.Time) ([]app.ExternalFlow, error) {
	rows, err := r.q.TreeExternalFlows(ctx, TreeExternalFlowsParams{UserID: userID, AccountIds: accountIDs, FromDate: from, ToDate: to})
	if err != nil {
		return nil, fmt.Errorf("tree external flows: %w", err)
	}
	out := make([]app.ExternalFlow, len(rows))
	for i, row := range rows {
		value, err := money.New(row.Flow, money.Currency(row.BalancingCurrency))
		if err != nil {
			return nil, fmt.Errorf("external flow of %s: %w", row.Date.Format(time.DateOnly), err)
		}
		out[i] = app.ExternalFlow{Date: row.Date, Value: value}
	}
	return out, nil
}

func (r *Repository) TreeFirstPosting(ctx context.Context, userID int64, accountIDs []uuid.UUID) (time.Time, bool, error) {
	row, err := r.q.TreeFirstPosting(ctx, TreeFirstPostingParams{UserID: userID, AccountIds: accountIDs})
	if err != nil {
		return time.Time{}, false, fmt.Errorf("tree first posting: %w", err)
	}
	return row.FirstOn, row.Found, nil
}

func (r *Repository) BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis app.Basis) (int64, error) {
	if basis == app.BasisSettled {
		return r.q.BalanceSettledAt(ctx, BalanceSettledAtParams{UserID: userID, AccountID: accountID, OnDate: &date})
	}
	return r.q.BalanceBookedAt(ctx, BalanceBookedAtParams{UserID: userID, AccountID: accountID, OnDate: date})
}

func (r *Repository) BalancesAt(ctx context.Context, userID int64, date time.Time, basis app.Basis) ([]app.AccountTotal, error) {
	if basis == app.BasisSettled {
		rows, err := r.q.AccountBalancesSettledAt(ctx, AccountBalancesSettledAtParams{UserID: userID, OnDate: &date})
		return mapAll(rows, func(row AccountBalancesSettledAtRow) app.AccountTotal {
			return app.AccountTotal{AccountID: row.ID, Instrument: money.Currency(row.Instrument), Total: row.Total}
		}), err
	}
	rows, err := r.q.AccountBalancesBookedAt(ctx, AccountBalancesBookedAtParams{UserID: userID, OnDate: date})
	return mapAll(rows, func(row AccountBalancesBookedAtRow) app.AccountTotal {
		return app.AccountTotal{AccountID: row.ID, Instrument: money.Currency(row.Instrument), Total: row.Total}
	}), err
}

func (r *Repository) CategoryTotal(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) (int64, error) {
	return r.q.CategoryTotal(ctx, CategoryTotalParams{UserID: userID, AccountID: accountID, FromDate: from, ToDate: to})
}

func (r *Repository) CategoryMonthlyTotals(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) (map[time.Time]int64, error) {
	rows, err := r.q.CategoryMonthlyTotals(ctx, CategoryMonthlyTotalsParams{UserID: userID, AccountID: accountID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make(map[time.Time]int64, len(rows))
	for _, row := range rows {
		out[row.Month] = row.Total
	}
	return out, nil
}

func (r *Repository) OwnCategoryMonthlyTotals(ctx context.Context, userID int64, class string, from, to time.Time) ([]app.CategoryMonth, error) {
	rows, err := r.q.OwnCategoryMonthlyTotals(ctx, OwnCategoryMonthlyTotalsParams{UserID: userID, AccountClass: class, FromDate: from, ToDate: to})
	if err != nil {
		return nil, fmt.Errorf("own category monthly totals: %w", err)
	}
	out := make([]app.CategoryMonth, len(rows))
	for i, row := range rows {
		out[i] = app.CategoryMonth{CategoryID: row.AccountID, Month: row.Month, Total: row.Total}
	}
	return out, nil
}

func (r *Repository) InsertBillingRule(ctx context.Context, userID int64, accountID uuid.UUID, rule domain.BillingCycleRule) (domain.BillingCycleRule, error) {
	p := InsertBillingRuleParams{
		UserID: userID, AccountID: accountID, EffectiveFrom: rule.EffectiveFrom.FirstDay(),
		DueDay:               int16(rule.DueDay), //nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		ClosingDayAssignment: rule.Assignment, DueDateAdjustment: rule.Adjustment, Calendar: rule.Calendar,
		ClosingMode: rule.ClosingMode, ClosingAdjustment: rule.ClosingAdjustment,
	}
	if rule.ClosingMode == domain.ClosingBeforeDue {
		days := int16(rule.ClosingDaysBeforeDue) //nolint:gosec // 1 to 28 (domain.NewBillingCycleRule).
		p.ClosingDaysBeforeDue = &days
	} else {
		day := int16(rule.ClosingDay) //nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		p.ClosingDay = &day
	}
	row, err := r.q.InsertBillingRule(ctx, p)
	if err != nil {
		return domain.BillingCycleRule{}, duplicate(err, "effective_from")
	}
	return toBillingRule(row), nil
}

func (r *Repository) BillingRules(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Rules, error) {
	rows, err := r.q.ListBillingRules(ctx, ListBillingRulesParams{UserID: userID, AccountID: accountID})
	return mapAll(rows, toBillingRule), err
}

func (r *Repository) InsertCreditLimit(ctx context.Context, userID int64, l app.CreditLimit) (app.CreditLimit, error) {
	_, err := r.q.InsertCreditLimit(ctx, InsertCreditLimitParams{UserID: userID, AccountID: l.AccountID, EffectiveFrom: l.EffectiveFrom, Amount: l.Amount.Amount()})
	if err != nil {
		return app.CreditLimit{}, err
	}
	return l, nil
}

func (r *Repository) CreditLimits(ctx context.Context, userID int64, accountID uuid.UUID) ([]app.CreditLimit, error) {
	rows, err := r.q.ListCreditLimits(ctx, ListCreditLimitsParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return nil, err
	}
	a, err := r.Account(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}
	out := make([]app.CreditLimit, len(rows))
	for i, row := range rows {
		amount, err := money.New(row.Amount, a.Instrument)
		if err != nil {
			return nil, err
		}
		out[i] = app.CreditLimit{AccountID: row.AccountID, EffectiveFrom: row.EffectiveFrom, Amount: amount}
	}
	return out, nil
}

func (r *Repository) InsertCard(ctx context.Context, c domain.Card) (domain.Card, error) {
	row, err := r.q.InsertCard(ctx, InsertCardParams{UserID: c.UserID, AccountID: c.AccountID, Holder: c.Holder, LastFour: c.LastFour, Virtual: c.Virtual, ForeignChargeBp: int32(c.ForeignChargeBP)}) //nolint:gosec // G115: NewCard bounds the rate to 0–10000
	if err != nil {
		return domain.Card{}, referenceError(err)
	}
	return toCard(row), nil
}

func (r *Repository) SetCardActive(ctx context.Context, userID int64, id uuid.UUID, active bool) (domain.Card, error) {
	row, err := r.q.SetCardActive(ctx, SetCardActiveParams{UserID: userID, ID: id, Active: active})
	if err != nil {
		return domain.Card{}, notFound(err)
	}
	return toCard(row), nil
}

func (r *Repository) Cards(ctx context.Context, userID int64, accountID uuid.UUID) ([]domain.Card, error) {
	rows, err := r.q.ListCards(ctx, ListCardsParams{UserID: userID, AccountID: accountID})
	return mapAll(rows, toCard), err
}

func (r *Repository) EnsureStatement(ctx context.Context, userID int64, accountID uuid.UUID, d domain.StatementDates, due time.Time) (uuid.UUID, error) {
	return r.q.EnsureStatement(ctx, EnsureStatementParams{
		UserID: userID, AccountID: accountID, ReferenceMonth: d.Reference.FirstDay(), ClosingDate: d.Closing, DueDate: due,
	})
}

func (r *Repository) Statements(ctx context.Context, userID int64, accountID uuid.UUID) ([]app.Statement, error) {
	rows, err := r.q.ListStatements(ctx, ListStatementsParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return nil, err
	}
	lines, err := r.q.ListStatementLines(ctx, ListStatementLinesParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return nil, err
	}
	factRows, err := r.q.ListStatementFacts(ctx, ListStatementFactsParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return nil, err
	}
	facts := make(map[uuid.UUID][]domain.StatementFact)
	for _, f := range factRows {
		facts[f.StatementID] = append(facts[f.StatementID], domain.StatementFact{
			UserID: f.UserID, StatementID: f.StatementID, Source: f.Source, Closing: f.ClosingDate, Due: f.DueDate,
			Total: f.Total, Minimum: f.Minimum,
		})
	}
	byStatement := make(map[uuid.UUID][]domain.StatementLine)
	for _, l := range lines {
		byStatement[l.StatementID.UUID] = append(byStatement[l.StatementID.UUID], domain.StatementLine{Role: deref(l.CardRole), Amount: l.Amount, Date: l.BookedOn})
	}
	out := make([]app.Statement, len(rows))
	for i, row := range rows {
		out[i] = app.Statement{
			ID: row.ID, AccountID: row.AccountID, FinancedBy: row.FinancedByPlanID.UUID, Reconciled: row.Reconciled,
			Input: domain.StatementInput{
				Reference: domain.MonthOf(row.ReferenceMonth), Closing: row.ClosingDate, Due: row.DueDate,
				Lines: byStatement[row.ID], Financed: row.FinancedByPlanID.Valid,
			},
			Fact: domain.EffectiveFact(facts[row.ID]),
		}
	}
	return out, nil
}

func (r *Repository) HasOpeningBalance(ctx context.Context, userID int64, accountID uuid.UUID) (bool, error) {
	return r.q.HasOpeningBalance(ctx, HasOpeningBalanceParams{UserID: userID, AccountID: accountID})
}

func (r *Repository) StatementClosings(ctx context.Context, userID int64, accountID uuid.UUID) (map[domain.ReferenceMonth]time.Time, error) {
	rows, err := r.q.ListStatementClosings(ctx, ListStatementClosingsParams{UserID: userID, AccountID: accountID})
	out := make(map[domain.ReferenceMonth]time.Time, len(rows))
	for _, row := range rows {
		out[domain.MonthOf(row.ReferenceMonth)] = row.ClosingDate
	}
	return out, err
}

func (r *Repository) SaveStatementFact(ctx context.Context, f domain.StatementFact) error {
	return r.q.UpsertStatementFact(ctx, UpsertStatementFactParams{
		UserID: f.UserID, StatementID: f.StatementID, Source: f.Source, ClosingDate: f.Closing, DueDate: f.Due,
		Total: f.Total, Minimum: f.Minimum,
	})
}

func (r *Repository) DeleteStatementFact(ctx context.Context, userID int64, statementID uuid.UUID, source string) error {
	return r.q.DeleteStatementFact(ctx, DeleteStatementFactParams{UserID: userID, StatementID: statementID, Source: source})
}

func (r *Repository) RedatablePostings(ctx context.Context, userID int64, accountID uuid.UUID) ([]app.RedatablePosting, error) {
	rows, err := r.q.ListRedatablePostings(ctx, ListRedatablePostingsParams{UserID: userID, AccountID: accountID})
	out := make([]app.RedatablePosting, len(rows))
	for i, row := range rows {
		out[i] = app.RedatablePosting{ID: row.ID, Date: row.BookedOn, StatementID: row.StatementID}
	}
	return out, err
}

func (r *Repository) PendingOnReported(ctx context.Context, userID int64, accountID uuid.UUID) ([]app.RedatablePosting, error) {
	rows, err := r.q.ListPendingOnReported(ctx, ListPendingOnReportedParams{UserID: userID, AccountID: accountID})
	out := make([]app.RedatablePosting, len(rows))
	for i, row := range rows {
		out[i] = app.RedatablePosting{ID: row.ID, StatementID: row.StatementID}
	}
	return out, err
}

func (r *Repository) MovePostingStatement(ctx context.Context, userID int64, postingID, statementID uuid.UUID) error {
	return r.q.MovePostingStatement(ctx, MovePostingStatementParams{UserID: userID, ID: postingID, StatementID: nullUUID(statementID)})
}

func (r *Repository) StatementAccount(ctx context.Context, userID int64, statementID uuid.UUID) (uuid.UUID, error) {
	row, err := r.q.GetStatement(ctx, GetStatementParams{UserID: userID, ID: statementID})
	if err != nil {
		return uuid.Nil, notFound(err)
	}
	return row.AccountID, nil
}

func (r *Repository) StatementPostings(ctx context.Context, userID int64, statementID uuid.UUID) ([]app.StatementPosting, error) {
	rows, err := r.q.ListStatementPostings(ctx, ListStatementPostingsParams{UserID: userID, StatementID: nullUUID(statementID)})
	if err != nil {
		return nil, err
	}
	out := make([]app.StatementPosting, len(rows))
	for i, row := range rows {
		out[i] = app.StatementPosting{
			TransactionID: row.TransactionID, Date: row.Date, Description: row.Description,
			CardRole: deref(row.CardRole), Amount: row.Amount, Basis: row.StatementBasis,
		}
		if row.InstallmentPlanID.Valid && row.InstallmentNumber != nil && row.InstallmentCount != nil {
			out[i].Installment = &domain.InstallmentRef{PlanID: row.InstallmentPlanID.UUID, Number: int(*row.InstallmentNumber), Count: int(*row.InstallmentCount)}
		}
	}
	return out, nil
}

func (r *Repository) OpenStatementsFrom(ctx context.Context, userID int64, accountID uuid.UUID, from domain.ReferenceMonth, today time.Time) ([]app.Statement, error) {
	rows, err := r.q.ListOpenStatementsFrom(ctx, ListOpenStatementsFromParams{UserID: userID, AccountID: accountID, FromMonth: from.FirstDay(), Today: today})
	if err != nil {
		return nil, err
	}
	out := make([]app.Statement, len(rows))
	for i, row := range rows {
		out[i] = app.Statement{ID: row.ID, AccountID: row.AccountID, Input: domain.StatementInput{
			Reference: domain.MonthOf(row.ReferenceMonth), Closing: row.ClosingDate, Due: row.DueDate,
		}}
	}
	return out, nil
}

func (r *Repository) UpdateStatementDates(ctx context.Context, id uuid.UUID, closing, due time.Time) error {
	return r.q.UpdateStatementDates(ctx, UpdateStatementDatesParams{ID: id, ClosingDate: closing, DueDate: due})
}

func (r *Repository) InsertPlan(ctx context.Context, p domain.InstallmentPlan) error {
	return r.q.InsertInstallmentPlan(ctx, InsertInstallmentPlanParams{
		ID: p.ID, UserID: p.UserID, AccountID: p.AccountID, OriginTransactionID: p.OriginTransactionID, PlanKind: p.Kind,
		InstallmentCount: int16(p.Count), //nolint:gosec // at most 420 installments.
		Principal:        p.Principal.Amount(), Interest: p.Interest.Amount(), FirstStatementID: p.FirstStatementID,
	})
}

func (r *Repository) SystemAccount(ctx context.Context, userID int64, role domain.SystemRole) (domain.Account, error) {
	row, err := r.q.GetSystemAccount(ctx, GetSystemAccountParams{UserID: userID, SystemRole: nullString(string(role))})
	if err != nil {
		return domain.Account{}, notFound(err)
	}
	return toAccount(row), nil
}

func (r *Repository) PriorInstallments(ctx context.Context, userID int64, accountID uuid.UUID, month domain.ReferenceMonth) (int64, error) {
	return r.q.PriorInstallments(ctx, PriorInstallmentsParams{UserID: userID, AccountID: accountID, ReferenceMonth: month.FirstDay()})
}

func (r *Repository) CommittedInstallments(ctx context.Context, userID int64, accountID uuid.UUID, month domain.ReferenceMonth, today time.Time) (int64, error) {
	return r.q.CommittedInstallments(ctx, CommittedInstallmentsParams{UserID: userID, AccountID: accountID, ReferenceMonth: month.FirstDay(), Today: today})
}

func (r *Repository) SetStatementFinanced(ctx context.Context, statementID, planID uuid.UUID) error {
	return r.q.SetStatementFinanced(ctx, SetStatementFinancedParams{ID: statementID, PlanID: nullUUID(planID)})
}

func (r *Repository) Plan(ctx context.Context, userID int64, id uuid.UUID) (domain.InstallmentPlan, error) {
	row, err := r.q.GetPlan(ctx, GetPlanParams{UserID: userID, ID: id})
	if err != nil {
		return domain.InstallmentPlan{}, notFound(err)
	}
	card, err := r.Account(ctx, userID, row.AccountID)
	if err != nil {
		return domain.InstallmentPlan{}, err
	}
	principal, err := money.New(row.Principal, card.Instrument)
	if err != nil {
		return domain.InstallmentPlan{}, err
	}
	interest, err := money.New(row.Interest, card.Instrument)
	if err != nil {
		return domain.InstallmentPlan{}, err
	}
	return domain.InstallmentPlan{
		ID: row.ID, UserID: row.UserID, AccountID: row.AccountID, OriginTransactionID: row.OriginTransactionID,
		Kind: row.PlanKind, Count: int(row.InstallmentCount), Principal: principal, Interest: interest,
		FirstStatementID: row.FirstStatementID,
	}, nil
}

func (r *Repository) PlanState(ctx context.Context, userID int64, originID uuid.UUID) (cancelled, anticipated bool, err error) {
	row, err := r.q.PlanState(ctx, PlanStateParams{UserID: userID, OriginID: originID})
	if err != nil {
		return false, false, err
	}
	return row.Cancelled, row.Anticipated, nil
}

func (r *Repository) AnticipatedReferences(ctx context.Context, userID int64, originID uuid.UUID) (map[domain.ReferenceMonth]struct{}, error) {
	rows, err := r.q.AnticipatedReferences(ctx, AnticipatedReferencesParams{UserID: userID, OriginID: originID})
	if err != nil {
		return nil, err
	}
	out := make(map[domain.ReferenceMonth]struct{}, len(rows))
	for _, row := range rows {
		out[domain.MonthOf(row)] = struct{}{}
	}
	return out, nil
}

func (r *Repository) AnticipationCharges(ctx context.Context, userID int64, originID uuid.UUID) ([]app.PlanInstallment, error) {
	rows, err := r.q.ListAnticipationCharges(ctx, ListAnticipationChargesParams{UserID: userID, OriginID: originID})
	if err != nil {
		return nil, err
	}
	out := make([]app.PlanInstallment, len(rows))
	for i, row := range rows {
		out[i] = app.PlanInstallment{Amount: row.Amount, Reference: domain.MonthOf(row.ReferenceMonth), Closing: row.ClosingDate}
	}
	return out, nil
}

func (r *Repository) AnticipationDiscount(ctx context.Context, userID int64, originID uuid.UUID) (int64, error) {
	return r.q.AnticipationDiscount(ctx, AnticipationDiscountParams{UserID: userID, OriginID: originID})
}

func (r *Repository) PlanInstallments(ctx context.Context, userID int64, planID uuid.UUID) ([]app.PlanInstallment, error) {
	rows, err := r.q.ListPlanInstallments(ctx, ListPlanInstallmentsParams{UserID: userID, InstallmentPlanID: nullUUID(planID)})
	if err != nil {
		return nil, err
	}
	out := make([]app.PlanInstallment, len(rows))
	for i, row := range rows {
		number := 0
		if row.InstallmentNumber != nil {
			number = int(*row.InstallmentNumber)
		}
		out[i] = app.PlanInstallment{Number: number, Amount: row.Amount, Reference: domain.MonthOf(row.ReferenceMonth), Closing: row.ClosingDate}
	}
	return out, nil
}

func (r *Repository) RefundedTotal(ctx context.Context, userID int64, originID uuid.UUID) (int64, error) {
	return r.q.RefundedTotal(ctx, RefundedTotalParams{UserID: userID, ToTransactionID: originID})
}

func (r *Repository) ReimbursedTotal(ctx context.Context, userID int64, originID, exceptFrom uuid.UUID) (int64, error) {
	return r.q.ReimbursedTotal(ctx, ReimbursedTotalParams{UserID: userID, OriginID: originID, ExceptFrom: exceptFrom})
}

func (r *Repository) ReimbursementCandidates(ctx context.Context, q app.CandidateQuery) ([]app.CandidateRow, error) {
	rows, err := r.q.ListReimbursementCandidates(ctx, ListReimbursementCandidatesParams{
		Instrument: string(q.Instrument), UserID: q.UserID, TransactionID: q.ExcludeID, FromDate: q.From, ToDate: q.To,
		Amount: q.Amount, MaxRows: int32(q.MaxRows), //nolint:gosec // the limit is a small constant.
	})
	if err != nil {
		return nil, err
	}
	out := make([]app.CandidateRow, len(rows))
	for i, row := range rows {
		out[i] = app.CandidateRow{ID: row.ID, Remaining: row.Remaining, Allocated: row.Allocated}
	}
	return out, nil
}

func (r *Repository) ReimbursementSources(ctx context.Context, q app.SourceQuery) ([]app.SourceRow, error) {
	rows, err := r.q.ListReimbursementSources(ctx, ListReimbursementSourcesParams{
		Instrument: string(q.Instrument), UserID: q.UserID, TransactionID: q.ExcludeID, FromDate: q.From, ToDate: q.To,
		MaxRows: int32(q.MaxRows), //nolint:gosec // the limit is a small constant.
	})
	if err != nil {
		return nil, err
	}
	out := make([]app.SourceRow, len(rows))
	for i, row := range rows {
		out[i] = app.SourceRow{ID: row.ID, Free: row.Free}
	}
	return out, nil
}

func (r *Repository) SetReimbursementLinks(ctx context.Context, userID int64, from uuid.UUID, links []domain.Link) error {
	if err := r.q.DeleteReimbursementLinksFrom(ctx, DeleteReimbursementLinksFromParams{UserID: userID, FromTransactionID: from}); err != nil {
		return err
	}
	for _, l := range links {
		err := r.q.InsertLink(ctx, InsertLinkParams{UserID: userID, FromTransactionID: from, ToTransactionID: l.Target, LinkType: string(l.Type), Amount: linkAmount(l.Amount)})
		if err != nil {
			return referenceError(err)
		}
	}
	return nil
}

func toDispute(row LedgerDispute) app.Dispute {
	return app.Dispute{
		ID: row.ID, UserID: row.UserID, TransactionID: row.TransactionID, OpenedOn: row.OpenedOn,
		ResolvedOn: row.ResolvedOn, Outcome: deref(row.Outcome), RefundTransactionID: row.RefundTransactionID.UUID,
	}
}

func (r *Repository) InsertDispute(ctx context.Context, d app.Dispute) (app.Dispute, error) {
	row, err := r.q.InsertDispute(ctx, InsertDisputeParams{UserID: d.UserID, TransactionID: d.TransactionID, OpenedOn: d.OpenedOn})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return app.Dispute{}, app.ErrDisputeOpen
	}
	if err != nil {
		return app.Dispute{}, err
	}
	return toDispute(row), nil
}

func (r *Repository) Disputes(ctx context.Context, userID int64, transactionID uuid.UUID) ([]app.Dispute, error) {
	rows, err := r.q.ListDisputes(ctx, ListDisputesParams{UserID: userID, TransactionID: transactionID})
	if err != nil {
		return nil, err
	}
	out := make([]app.Dispute, len(rows))
	for i, row := range rows {
		out[i] = toDispute(row)
	}
	return out, nil
}

// linkAmount stores no amount for a link that holds none.
func linkAmount(amount int64) *int64 {
	if amount == 0 {
		return nil
	}
	return &amount
}

func storedAmount(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

func (r *Repository) LinksTo(ctx context.Context, userID int64, id uuid.UUID) ([]app.Reference, error) {
	rows, err := r.q.ListLinksTo(ctx, ListLinksToParams{UserID: userID, ToTransactionID: id})
	if err != nil {
		return nil, err
	}
	out := make([]app.Reference, len(rows))
	for i, row := range rows {
		out[i] = app.Reference{Type: domain.LinkType(row.LinkType), Source: row.FromTransactionID, Amount: storedAmount(row.Amount), Currency: row.BalancingCurrency}
	}
	return out, nil
}

func (r *Repository) LockDispute(ctx context.Context, userID int64, id uuid.UUID) (app.Dispute, error) {
	row, err := r.q.GetDisputeForUpdate(ctx, GetDisputeForUpdateParams{UserID: userID, ID: id})
	if err != nil {
		return app.Dispute{}, notFound(err)
	}
	return toDispute(row), nil
}

func (r *Repository) ResolveDispute(ctx context.Context, d app.Dispute) (app.Dispute, error) {
	row, err := r.q.ResolveDispute(ctx, ResolveDisputeParams{
		ID: d.ID, ResolvedOn: d.ResolvedOn, Outcome: nullString(d.Outcome), RefundTransactionID: nullUUID(d.RefundTransactionID),
	})
	if err != nil {
		return app.Dispute{}, err
	}
	return toDispute(row), nil
}
