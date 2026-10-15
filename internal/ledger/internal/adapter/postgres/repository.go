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
			Memo: nullString(p.Memo), StatementID: nullUUID(p.StatementID), CardRole: nullString(p.CardRole),
			InstallmentPlanID: installmentPlan(p.Installment), InstallmentNumber: installmentNumber(p.Installment),
			InstallmentCount: installmentCount(p.Installment),
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

func (r *Repository) InsertBillingRule(ctx context.Context, userID int64, accountID uuid.UUID, rule domain.BillingCycleRule) (domain.BillingCycleRule, error) {
	row, err := r.q.InsertBillingRule(ctx, InsertBillingRuleParams{
		UserID: userID, AccountID: accountID, EffectiveFrom: rule.EffectiveFrom.FirstDay(),
		ClosingDay: int16(rule.ClosingDay), DueDay: int16(rule.DueDay), //nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		ClosingDayAssignment: rule.Assignment, DueDateAdjustment: rule.Adjustment, Calendar: rule.Calendar,
	})
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
		return app.CreditLimit{}, duplicate(err, "effective_from")
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
	row, err := r.q.InsertCard(ctx, InsertCardParams{UserID: c.UserID, AccountID: c.AccountID, Holder: c.Holder, LastFour: c.LastFour, Virtual: c.Virtual})
	if err != nil {
		return domain.Card{}, referenceError(err)
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
	byStatement := make(map[uuid.UUID][]domain.StatementLine)
	for _, l := range lines {
		byStatement[l.StatementID.UUID] = append(byStatement[l.StatementID.UUID], domain.StatementLine{Role: deref(l.CardRole), Amount: l.Amount})
	}
	out := make([]app.Statement, len(rows))
	for i, row := range rows {
		out[i] = app.Statement{
			ID: row.ID, AccountID: row.AccountID, FinancedBy: row.FinancedByPlanID.UUID,
			Input: domain.StatementInput{
				Reference: domain.MonthOf(row.ReferenceMonth), Closing: row.ClosingDate, Due: row.DueDate,
				Lines: byStatement[row.ID], Financed: row.FinancedByPlanID.Valid,
			},
		}
	}
	return out, nil
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
			CardRole: deref(row.CardRole), Amount: row.Amount,
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
	return domain.InstallmentPlan{
		ID: row.ID, UserID: row.UserID, AccountID: row.AccountID, OriginTransactionID: row.OriginTransactionID,
		Kind: row.PlanKind, Count: int(row.InstallmentCount), FirstStatementID: row.FirstStatementID,
	}, nil
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
