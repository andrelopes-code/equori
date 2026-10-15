package postgres

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
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
	db db
	q  *Queries
	tx pgx.Tx
}

func NewRepository(db db) *Repository {
	r := &Repository{db: db, q: New(db)}
	if tx, ok := db.(pgx.Tx); ok {
		r.tx = tx
	}
	return r
}

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		return fn(&Repository{db: tx, q: r.q.WithTx(tx), tx: tx})
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
	row, err := r.q.InsertInstitution(ctx, InsertInstitutionParams{UserID: i.UserID, Name: i.Name, Code: nullString(i.Code)})
	if err != nil {
		return app.Institution{}, duplicate(err, "name")
	}
	return toInstitution(row), nil
}

func (r *Repository) ListInstitutions(ctx context.Context, userID int64) ([]app.Institution, error) {
	rows, err := r.q.ListInstitutions(ctx, userID)
	return mapAll(rows, toInstitution), err
}

func (r *Repository) InsertPayee(ctx context.Context, p app.Payee) (app.Payee, error) {
	row, err := r.q.InsertPayee(ctx, InsertPayeeParams{UserID: p.UserID, Name: p.Name})
	if err != nil {
		return app.Payee{}, duplicate(err, "name")
	}
	return toPayee(row), nil
}

func (r *Repository) Payee(ctx context.Context, userID int64, id uuid.UUID) (app.Payee, error) {
	row, err := r.q.GetPayee(ctx, GetPayeeParams{UserID: userID, ID: id})
	if err != nil {
		return app.Payee{}, notFound(err)
	}
	return toPayee(row), nil
}

func (r *Repository) ListPayees(ctx context.Context, userID int64) ([]app.Payee, error) {
	rows, err := r.q.ListPayees(ctx, userID)
	return mapAll(rows, toPayee), err
}

func (r *Repository) ListTags(ctx context.Context, userID int64) ([]string, error) {
	return r.q.ListTags(ctx, userID)
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

func (r *Repository) ListAccounts(ctx context.Context, userID int64) ([]domain.Account, error) {
	rows, err := r.q.ListAccounts(ctx, userID)
	return mapAll(rows, toAccount), err
}

func (r *Repository) InsertAccount(ctx context.Context, a domain.Account) (domain.Account, error) {
	row, err := r.q.InsertAccount(ctx, InsertAccountParams{
		UserID: a.UserID, Name: a.Name, AccountClass: string(a.Class), Kind: nullString(string(a.Kind)),
		Instrument: string(a.Instrument), ParentID: nullUUID(a.ParentID), InstitutionID: nullUUID(a.InstitutionID),
		CounterpartyPayeeID: nullUUID(a.CounterpartyID), OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn,
		YieldMode: string(a.YieldMode), SystemRole: nullString(string(a.SystemRole)),
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
		posting, err := toPosting(p)
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
		t.Links = append(t.Links, domain.Link{Type: domain.LinkType(l.LinkType), Target: l.ToTransactionID})
	}
	return out, nil
}

func (r *Repository) InsertTransaction(ctx context.Context, t domain.Transaction) (domain.Transaction, error) {
	_, err := r.q.InsertTransaction(ctx, InsertTransactionParams{
		ID: t.ID, UserID: t.UserID, Date: t.Date, Description: t.Description, PayeeID: nullUUID(t.PayeeID),
		BalancingCurrency: string(t.BalancingCurrency), Origin: string(t.Origin), Version: int32(t.Version), //nolint:gosec // version is a small positive counter.
	})
	if err != nil {
		return domain.Transaction{}, referenceError(err)
	}
	if err := r.writeChildren(ctx, t); err != nil {
		return domain.Transaction{}, err
	}
	return r.Transaction(ctx, t.UserID, t.ID)
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

func (r *Repository) writeChildren(ctx context.Context, t domain.Transaction) error {
	for i, p := range t.Postings {
		err := r.q.InsertPosting(ctx, InsertPostingParams{
			UserID: t.UserID, TransactionID: t.ID, AccountID: p.AccountID, Position: int16(i), //nolint:gosec // at most 500 postings (domain.MaxPostings).
			Amount: p.Amount.Amount(), Weight: p.Weight.Amount(), BookedOn: t.Date, SettledOn: p.SettledOn,
			Status: string(p.Status), OriginalAmount: originalAmount(p.Original), OriginalInstrument: originalInstrument(p.Original),
			Memo: nullString(p.Memo),
		})
		if err != nil {
			return referenceError(err)
		}
	}
	for _, tag := range t.Tags {
		tagID, err := r.q.UpsertTag(ctx, UpsertTagParams{UserID: t.UserID, Name: tag})
		if err != nil {
			return err
		}
		if err := r.q.InsertTransactionTag(ctx, InsertTransactionTagParams{UserID: t.UserID, TransactionID: t.ID, TagID: tagID}); err != nil {
			return err
		}
	}
	for _, l := range t.Links {
		if err := r.q.InsertLink(ctx, InsertLinkParams{UserID: t.UserID, FromTransactionID: t.ID, ToTransactionID: l.Target, LinkType: string(l.Type)}); err != nil {
			return referenceError(err)
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
		FromDate: q.From, ToDate: q.To, RowLimit: int32(q.Limit), //nolint:gosec // limit is at most page.MaxLimit + 1.
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
		t, err := s.transaction()
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

func (r *Repository) BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis app.Basis) (int64, error) {
	if basis == app.BasisSettled {
		return r.q.BalanceSettledAt(ctx, BalanceSettledAtParams{UserID: userID, AccountID: accountID, OnDate: &date})
	}
	return r.q.BalanceBookedAt(ctx, BalanceBookedAtParams{UserID: userID, AccountID: accountID, OnDate: date})
}
