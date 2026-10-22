package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toConnection(row IngestionConnection) domain.Connection {
	return domain.Connection{
		ID: row.ID, UserID: row.UserID, IntegrationID: row.IntegrationID, ItemID: row.ExternalItemID, Name: row.Name,
		ProviderStatus: row.ProviderStatus, LastItemUpdateAt: row.LastItemUpdateAt, NextItemUpdateAt: row.NextItemUpdateAt,
		LastSyncedAt: row.LastSyncedAt,
		LastError:    value(row.LastError), CreatedAt: row.CreatedAt,
	}
}

func toExternalAccount(row IngestionExternalAccount) domain.ExternalAccount {
	a := domain.ExternalAccount{
		ID: row.ID, UserID: row.UserID, ConnectionID: row.ConnectionID, ExternalID: row.ExternalAccountID,
		Type: row.Type, Subtype: row.Subtype, Name: row.Name, FormerNames: row.FormerNames, NumberLast4: value(row.NumberLast4),
		Currency: row.Currency,
		Ignored:  row.Ignored, LastSyncedOn: row.LastSyncedOn,
	}
	if row.AccountID.Valid {
		a.AccountID, a.SyncFrom = &row.AccountID.UUID, row.SyncFrom
	}
	if row.BalanceOn != nil && row.BalanceAmount != nil {
		a.Balance = &domain.Balance{Date: *row.BalanceOn, Amount: *row.BalanceAmount}
	}
	return a
}

func (r *Repository) InsertConnection(ctx context.Context, c domain.Connection) (domain.Connection, error) {
	var out domain.Connection
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		row, err := q.InsertConnection(ctx, InsertConnectionParams{
			UserID: c.UserID, IntegrationID: c.IntegrationID, ExternalItemID: c.ItemID, Name: c.Name,
			ProviderStatus: c.ProviderStatus, LastItemUpdateAt: c.LastItemUpdateAt,
		})
		if err != nil {
			return err
		}
		out = toConnection(row)
		for _, a := range c.Accounts {
			saved, err := q.InsertExternalAccount(ctx, InsertExternalAccountParams{
				UserID: c.UserID, ConnectionID: row.ID, ExternalAccountID: a.ExternalID, Type: a.Type, Subtype: a.Subtype,
				Name: a.Name, NumberLast4: optional(a.NumberLast4), Currency: a.Currency,
			})
			if err != nil {
				return err
			}
			out.Accounts = append(out.Accounts, toExternalAccount(saved))
		}
		return nil
	})
	switch {
	case violates(err, uniqueViolation, "ingestion_connection_item_key"):
		return domain.Connection{}, &domain.FieldError{Field: "external_id", Message: "is already connected through this integration"}
	case err != nil:
		return domain.Connection{}, notFound(err)
	}
	return out, nil
}

func (r *Repository) InsertMissingExternalAccount(ctx context.Context, a domain.ExternalAccount) error {
	return notFound(r.q.InsertMissingExternalAccount(ctx, InsertMissingExternalAccountParams{
		UserID: a.UserID, ConnectionID: a.ConnectionID, ExternalAccountID: a.ExternalID, Type: a.Type, Subtype: a.Subtype,
		Name: a.Name, NumberLast4: optional(a.NumberLast4), Currency: a.Currency,
	}))
}

func (r *Repository) RenameExternalAccount(ctx context.Context, userID int64, id uuid.UUID, name string) error {
	return r.q.RenameExternalAccount(ctx, RenameExternalAccountParams{UserID: userID, ID: id, Name: name})
}

// withAccounts loads the external accounts of the connections in one query.
func (r *Repository) withAccounts(ctx context.Context, userID int64, cs []domain.Connection) error {
	ids := make([]uuid.UUID, len(cs))
	index := make(map[uuid.UUID]int, len(cs))
	for i, c := range cs {
		ids[i], index[c.ID] = c.ID, i
	}
	rows, err := r.q.ExternalAccountsOf(ctx, ExternalAccountsOfParams{UserID: userID, ConnectionIds: ids})
	if err != nil {
		return err
	}
	for _, row := range rows {
		i := index[row.ConnectionID]
		cs[i].Accounts = append(cs[i].Accounts, toExternalAccount(row))
	}
	return nil
}

func (r *Repository) Connection(ctx context.Context, userID int64, id uuid.UUID) (domain.Connection, error) {
	row, err := r.q.GetConnection(ctx, GetConnectionParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Connection{}, notFound(err)
	}
	cs := []domain.Connection{toConnection(row)}
	return cs[0], r.withAccounts(ctx, userID, cs)
}

func (r *Repository) ListConnections(ctx context.Context, userID int64, p page.Request[app.NameKey]) ([]domain.Connection, *app.NameKey, error) {
	limit, name, id := namePage(p)
	rows, err := r.q.ListConnections(ctx, ListConnectionsParams{UserID: userID, RowLimit: limit, AfterName: name, AfterID: id})
	if err != nil {
		return nil, nil, err
	}
	out, next := trimPage(rows, p.Limit, toConnection, func(row IngestionConnection) app.NameKey {
		return app.NameKey{Name: row.Name, ID: row.ID}
	})
	return out, next, r.withAccounts(ctx, userID, out)
}

func (r *Repository) DeleteConnection(ctx context.Context, userID int64, id uuid.UUID) error {
	n, err := r.q.DeleteConnection(ctx, DeleteConnectionParams{UserID: userID, ID: id})
	if err == nil && n == 0 {
		return app.ErrNotFound
	}
	return err
}

func (r *Repository) SaveMapping(ctx context.Context, a domain.ExternalAccount) (domain.ExternalAccount, error) {
	params := SaveMappingParams{UserID: a.UserID, ConnectionID: a.ConnectionID, ID: a.ID, SyncFrom: a.SyncFrom, Ignored: a.Ignored}
	if a.AccountID != nil {
		params.AccountID = uuid.NullUUID{UUID: *a.AccountID, Valid: true}
	}
	row, err := r.q.SaveMapping(ctx, params)
	if violates(err, uniqueViolation, "ingestion_external_account_feed_key") {
		return domain.ExternalAccount{}, &domain.FieldError{Field: "account_id", Message: "already receives another external account"}
	}
	return toExternalAccount(row), notFound(err)
}

func (r *Repository) AccountFeed(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Feed, error) {
	var f domain.Feed
	widen := func(from, to *time.Time) {
		if from != nil && (f.From == nil || from.Before(*f.From)) {
			f.From = from
		}
		if to != nil && (f.To == nil || to.After(*f.To)) {
			f.To = to
		}
	}
	m, err := r.q.AccountMapping(ctx, AccountMappingParams{UserID: userID, AccountID: uuid.NullUUID{UUID: accountID, Valid: true}})
	switch {
	case err == nil:
		widen(m.SyncFrom, m.LastSyncedOn)
	case !errors.Is(err, pgx.ErrNoRows):
		return domain.Feed{}, err
	}
	periods, err := r.q.AccountFilePeriods(ctx, AccountFilePeriodsParams{UserID: userID, AccountID: accountID})
	for _, p := range periods {
		widen(p.PeriodFrom, p.PeriodTo)
	}
	return f, err
}
