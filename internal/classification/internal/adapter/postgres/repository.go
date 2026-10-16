package postgres

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var _ app.Repository = (*Repository)(nil)

const uniqueViolation = "23505"

// Repository runs on the pool, or on a transaction inside InTx.
type Repository struct {
	pool *pgxpool.Pool
	db   DBTX
	q    *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool, db: pool, q: New(pool)}
}

// NewTxRepository runs on tx, as outbox handlers do.
func NewTxRepository(tx pgx.Tx) *Repository { return &Repository{db: tx, q: New(tx)} }

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	if r.pool == nil {
		return fn(r)
	}
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error { return fn(NewTxRepository(tx)) })
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}
	return err
}

func toRule(row ClassificationRule) (domain.Rule, error) {
	var conditions []domain.ConditionDoc
	var actions []domain.ActionDoc
	if err := json.Unmarshal(row.Conditions, &conditions); err != nil {
		return domain.Rule{}, fmt.Errorf("decode rule %s conditions: %w", row.ID, err)
	}
	if err := json.Unmarshal(row.Actions, &actions); err != nil {
		return domain.Rule{}, fmt.Errorf("decode rule %s actions: %w", row.ID, err)
	}
	r, err := domain.RuleFromDocs(domain.Rule{
		ID: row.ID, Name: row.Name, Priority: int(row.Priority), Enabled: row.Enabled, StopProcessing: row.StopProcessing,
	}, conditions, actions)
	if err != nil {
		return domain.Rule{}, fmt.Errorf("stored rule %s: %w", row.ID, err)
	}
	return r, nil
}

func ruleDocs(r domain.Rule) (conditions, actions []byte, err error) {
	cs := make([]domain.ConditionDoc, len(r.Conditions))
	for i, c := range r.Conditions {
		cs[i] = c.Doc()
	}
	as := make([]domain.ActionDoc, len(r.Actions))
	for i, a := range r.Actions {
		as[i] = a.Doc()
	}
	if conditions, err = json.Marshal(cs); err != nil {
		return nil, nil, err
	}
	actions, err = json.Marshal(as)
	return conditions, actions, err
}

func toRules(rows []ClassificationRule) ([]domain.Rule, error) {
	out := make([]domain.Rule, len(rows))
	for i, row := range rows {
		r, err := toRule(row)
		if err != nil {
			return nil, err
		}
		out[i] = r
	}
	return out, nil
}

func (r *Repository) ListRules(ctx context.Context, userID int64, p page.Request[app.RuleKey]) ([]domain.Rule, *app.RuleKey, error) {
	params := ListRulesParams{UserID: userID, RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		priority := int32(p.After.Priority) //nolint:gosec // priorities are small positive integers
		params.AfterPriority = &priority
	}
	rows, err := r.q.ListRules(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	kept, more := page.Trim(rows, p.Limit)
	out, err := toRules(kept)
	if err != nil || !more {
		return out, nil, err
	}
	return out, &app.RuleKey{Priority: int(kept[len(kept)-1].Priority)}, nil
}

func (r *Repository) EnabledRules(ctx context.Context, userID int64) ([]domain.Rule, error) {
	rows, err := r.q.EnabledRules(ctx, userID)
	if err != nil {
		return nil, err
	}
	return toRules(rows)
}

func (r *Repository) LockRuleIDs(ctx context.Context, userID int64) ([]uuid.UUID, error) {
	return r.q.RuleIDs(ctx, userID)
}

func (r *Repository) Rule(ctx context.Context, userID int64, id uuid.UUID) (domain.Rule, error) {
	row, err := r.q.GetRule(ctx, GetRuleParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Rule{}, notFound(err)
	}
	return toRule(row)
}

func (r *Repository) InsertRule(ctx context.Context, userID int64, rule domain.Rule) (domain.Rule, error) {
	conditions, actions, err := ruleDocs(rule)
	if err != nil {
		return domain.Rule{}, err
	}
	row, err := r.q.InsertRule(ctx, InsertRuleParams{
		UserID: userID, Name: rule.Name, Enabled: rule.Enabled, StopProcessing: rule.StopProcessing, Conditions: conditions, Actions: actions,
	})
	if err != nil {
		return domain.Rule{}, err
	}
	return toRule(row)
}

func (r *Repository) UpdateRule(ctx context.Context, userID int64, rule domain.Rule) (domain.Rule, error) {
	conditions, actions, err := ruleDocs(rule)
	if err != nil {
		return domain.Rule{}, err
	}
	row, err := r.q.UpdateRule(ctx, UpdateRuleParams{
		UserID: userID, ID: rule.ID, Name: rule.Name, Enabled: rule.Enabled, StopProcessing: rule.StopProcessing, Conditions: conditions, Actions: actions,
	})
	if err != nil {
		return domain.Rule{}, notFound(err)
	}
	return toRule(row)
}

func (r *Repository) DeleteRule(ctx context.Context, userID int64, id uuid.UUID) error {
	n, err := r.q.DeleteRule(ctx, DeleteRuleParams{UserID: userID, ID: id})
	if err == nil && n == 0 {
		return app.ErrNotFound
	}
	return err
}

func (r *Repository) SetPriorities(ctx context.Context, userID int64, ids []uuid.UUID) error {
	// Swapping priorities passes through duplicates until the last update.
	if _, err := r.db.Exec(ctx, "SET CONSTRAINTS classification_rule_priority_key DEFERRED"); err != nil {
		return err
	}
	for i, id := range ids {
		if err := r.q.SetRulePriority(ctx, SetRulePriorityParams{UserID: userID, ID: id, Priority: int32(i + 1)}); err != nil { //nolint:gosec // at most 500 rules
			return err
		}
	}
	return nil
}

func toAlias(row ClassificationPayeeAlias) (domain.Alias, error) {
	return domain.NewAlias(domain.Alias{ID: row.ID, Pattern: row.Pattern, MatchType: domain.MatchType(row.MatchType), PayeeID: row.PayeeID})
}

func toAliases(rows []ClassificationPayeeAlias) ([]domain.Alias, error) {
	out := make([]domain.Alias, len(rows))
	for i, row := range rows {
		a, err := toAlias(row)
		if err != nil {
			return nil, fmt.Errorf("stored alias %s: %w", row.ID, err)
		}
		out[i] = a
	}
	return out, nil
}

func (r *Repository) ListAliases(ctx context.Context, userID int64, p page.Request[app.AliasKey]) ([]domain.Alias, *app.AliasKey, error) {
	params := ListAliasesParams{UserID: userID, RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		params.AfterID = uuid.NullUUID{UUID: p.After.ID, Valid: true}
	}
	rows, err := r.q.ListAliases(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	kept, more := page.Trim(rows, p.Limit)
	out, err := toAliases(kept)
	if err != nil || !more {
		return out, nil, err
	}
	return out, &app.AliasKey{ID: kept[len(kept)-1].ID}, nil
}

func (r *Repository) Aliases(ctx context.Context, userID int64) ([]domain.Alias, error) {
	rows, err := r.q.AllAliases(ctx, userID)
	if err != nil {
		return nil, err
	}
	return toAliases(rows)
}

func (r *Repository) Alias(ctx context.Context, userID int64, id uuid.UUID) (domain.Alias, error) {
	row, err := r.q.GetAlias(ctx, GetAliasParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Alias{}, notFound(err)
	}
	return toAlias(row)
}

func aliasError(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return app.ErrAliasExists
	}
	return notFound(err)
}

func (r *Repository) InsertAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error) {
	row, err := r.q.InsertAlias(ctx, InsertAliasParams{UserID: userID, Pattern: a.Pattern, MatchType: string(a.MatchType), PayeeID: a.PayeeID})
	if err != nil {
		return domain.Alias{}, aliasError(err)
	}
	return toAlias(row)
}

func (r *Repository) UpdateAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error) {
	row, err := r.q.UpdateAlias(ctx, UpdateAliasParams{UserID: userID, ID: a.ID, Pattern: a.Pattern, MatchType: string(a.MatchType), PayeeID: a.PayeeID})
	if err != nil {
		return domain.Alias{}, aliasError(err)
	}
	return toAlias(row)
}

func (r *Repository) DeleteAlias(ctx context.Context, userID int64, id uuid.UUID) error {
	n, err := r.q.DeleteAlias(ctx, DeleteAliasParams{UserID: userID, ID: id})
	if err == nil && n == 0 {
		return app.ErrNotFound
	}
	return err
}
