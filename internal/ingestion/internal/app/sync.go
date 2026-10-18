package app

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// blockedStatuses are item statuses that need the owner in Meu Pluggy; the item's data is
// stale, so the connection is not synced (P6 amendment A43).
var blockedStatuses = map[string]bool{"LOGIN_ERROR": true, "OUTDATED": true, "WAITING_USER_INPUT": true}

// SyncConnection syncs every mapped account of a connection now, one batch per account (P6
// amendments A36, A43).
func (s *Service) SyncConnection(ctx context.Context, userID int64, connectionID uuid.UUID) (domain.Connection, []domain.Batch, error) {
	if err := s.available(); err != nil {
		return domain.Connection{}, nil, err
	}
	return s.sync(ctx, userID, connectionID, true)
}

// sync reads the item and, unless it is blocked or, without force, has no data newer than
// the last sync, syncs the mapped accounts. The connection stores the item status and the
// outcome; its error names no identifier (A44).
func (s *Service) sync(ctx context.Context, userID int64, connectionID uuid.UUID, force bool) (domain.Connection, []domain.Batch, error) {
	c, err := s.repo.Connection(ctx, userID, connectionID)
	if err != nil {
		return domain.Connection{}, nil, err
	}
	batches, err := s.syncItem(ctx, &c, force)
	if err != nil {
		c.LastError = err.Error()
	}
	if saveErr := s.repo.SaveConnectionState(ctx, c); saveErr != nil {
		return c, batches, errors.Join(err, saveErr)
	}
	if errors.Is(err, ErrProviderUnauthorized) {
		err = &UnauthorizedError{Field: "integration_id"}
	}
	return c, batches, err
}

func (s *Service) syncItem(ctx context.Context, c *domain.Connection, force bool) ([]domain.Batch, error) {
	i, err := s.repo.Integration(ctx, c.UserID, c.IntegrationID)
	if err != nil {
		return nil, err
	}
	creds, err := s.credentials(i)
	if err != nil {
		return nil, err
	}
	status, updatedAt, err := s.agg.ItemState(ctx, i.ID, creds, c.ItemID)
	if err != nil {
		return nil, err
	}
	c.ProviderStatus, c.LastError = status, ""
	newer := updatedAt != nil && (c.LastItemUpdateAt == nil || updatedAt.After(*c.LastItemUpdateAt))
	if blockedStatuses[status] || (!force && c.LastSyncedAt != nil && !newer) {
		return nil, nil
	}
	if err := s.addMissingAccounts(ctx, c, creds); err != nil {
		return nil, err
	}
	var batches []domain.Batch
	// Reserved balances sync after the other accounts, so that the transfers the lines of a
	// bank account book come before the reserve assertion (A74).
	ordered := slices.SortedStableFunc(slices.Values(c.Accounts), func(a, b domain.ExternalAccount) int {
		return cmp.Compare(reserveRank(a), reserveRank(b))
	})
	for _, ext := range ordered {
		if ext.State() != domain.MappingMapped {
			continue
		}
		b, err := s.syncAccount(ctx, *c, ext, creds)
		if err != nil {
			return batches, err
		}
		batches = append(batches, b)
	}
	now := s.now()
	c.LastSyncedAt, c.LastItemUpdateAt = &now, updatedAt
	return batches, nil
}

func reserveRank(ext domain.ExternalAccount) int {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return 1
	}
	return 0
}

// addMissingAccounts stores, pending, every account and reserved balance the item reports
// that the connection lacks; stored accounts are not changed (A73).
func (s *Service) addMissingAccounts(ctx context.Context, c *domain.Connection, creds domain.Credentials) error {
	listed, err := s.agg.Accounts(ctx, c.IntegrationID, creds, c.ItemID)
	if err != nil {
		return err
	}
	known := make(map[string]bool, len(c.Accounts))
	for _, ext := range c.Accounts {
		known[ext.ExternalID] = true
	}
	added := false
	for _, a := range listed {
		if known[a.ExternalID] {
			continue
		}
		a.UserID, a.ConnectionID = c.UserID, c.ID
		if err := s.repo.InsertMissingExternalAccount(ctx, a); err != nil {
			return err
		}
		added = true
	}
	if !added {
		return nil
	}
	reloaded, err := s.repo.Connection(ctx, c.UserID, c.ID)
	if err != nil {
		return err
	}
	c.Accounts = reloaded.Accounts
	return nil
}

// syncAccount reads one mapped account for its window and records it as one batch: lines
// the aggregator stopped returning are withdrawn first, so that a line returned with a new
// id finds its released posting (A38); then the lines go through the P4 pipeline, and a
// bank balance becomes a balance assertion (A42).
func (s *Service) syncAccount(ctx context.Context, c domain.Connection, ext domain.ExternalAccount, creds domain.Credentials) (domain.Batch, error) {
	accountID := *ext.AccountID
	target, err := s.ledger.ImportTarget(ctx, c.UserID, accountID)
	if err != nil {
		return domain.Batch{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}
	today := s.today()
	from, to := ext.SyncWindow(today)
	unlock, err := s.repo.LockAccountImports(ctx, accountID)
	if err != nil {
		return domain.Batch{}, err
	}
	defer unlock()

	read, err := s.agg.ReadAccount(ctx, c.IntegrationID, creds, c.ItemID, ext.ExternalID, from, to, target.Currency.MinorUnits())
	if errors.Is(err, ErrAccountGone) && ext.Subtype == domain.SubtypeReservedBalance {
		// A reserved balance the item stopped reporting syncs without a balance (D2).
		read, err = domain.AccountRead{}, nil
	}
	if err != nil {
		return domain.Batch{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}
	batch, err := s.repo.InsertBatch(ctx, domain.Batch{
		UserID: c.UserID, AccountID: accountID, Source: domain.SourceOpenFinance, ExternalAccountID: &ext.ID,
		Currency: string(target.Currency), PeriodFrom: &from, PeriodTo: &to, Balance: domain.FileBalance{Status: domain.BalanceNone},
	})
	if err != nil {
		return domain.Batch{}, err
	}
	if err := s.withdraw(ctx, &batch, read.Seen, from, to); err != nil {
		return domain.Batch{}, err
	}
	if err := s.importRecords(ctx, &batch, target.Currency, read.Records, s.reserveTransfers(c, ext)); err != nil {
		return domain.Batch{}, err
	}
	if b := read.Balance; b != nil && !b.Date.After(today) {
		// The ledger decides an open assertion of this balance again on every sync (A77).
		if ext.Balance == nil || *ext.Balance != *b {
			batch.Balance = domain.FileBalance{Status: domain.BalanceRecorded, Date: &b.Date, Amount: b.Amount}
		}
		assert := s.ledger.AssertSyncedBalance
		if ext.Subtype == domain.SubtypeReservedBalance {
			assert = s.ledger.AssertSyncedReserve
		}
		err := assert(ctx, c.UserID, accountID, *b, target.Currency)
		switch {
		case errors.Is(err, ErrBalanceRejected):
			if batch.Balance.Status == domain.BalanceRecorded {
				batch.Balance.Status, batch.Balance.Reason = domain.BalanceSkipped, err.Error()
			}
		case err != nil:
			return domain.Batch{}, err
		}
		ext.Balance = b
	}
	if batch, err = s.repo.CompleteBatch(ctx, batch); err != nil {
		return domain.Batch{}, err
	}
	ext.LastSyncedOn = &today
	return batch, s.repo.MarkAccountSynced(ctx, ext)
}

// reserveTransfers resolves the reserve a bank line moves money into or out of from the
// reserve's name. A name held by two mapped reserves is ambiguous and resolves to none, and so
// does a line dated before the reserve's start date (A76).
func (s *Service) reserveTransfers(c domain.Connection, ext domain.ExternalAccount) func(domain.NormalizedRecord) *uuid.UUID {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return nil
	}
	byName := map[string]domain.ExternalAccount{}
	for _, x := range c.Accounts {
		if x.Subtype != domain.SubtypeReservedBalance || x.State() != domain.MappingMapped {
			continue
		}
		if _, dup := byName[x.Name]; dup {
			byName[x.Name] = domain.ExternalAccount{}
			continue
		}
		byName[x.Name] = x
	}
	return func(r domain.NormalizedRecord) *uuid.UUID {
		reserve, ok := byName[r.ReserveName]
		if r.ReserveName == "" || !ok || reserve.AccountID == nil || r.Date.Before(*reserve.SyncFrom) {
			return nil
		}
		return reserve.AccountID
	}
}

// withdraw marks withdrawn the account's aggregator records the window covers that the
// aggregator no longer returns, and releases their postings (A38). The first and last days
// of the window are left out: the aggregator filters by its own calendar day, which may
// differ from the record's date by one.
func (s *Service) withdraw(ctx context.Context, batch *domain.Batch, seen []string, from, to time.Time) error {
	if !from.AddDate(0, 0, 1).Before(to) {
		return nil
	}
	returned := make(map[string]bool, len(seen))
	for _, id := range seen {
		returned[id] = true
	}
	stored, err := s.repo.SyncedRecords(ctx, batch.UserID, batch.AccountID, from.AddDate(0, 0, 1), to.AddDate(0, 0, -1))
	if err != nil {
		return err
	}
	var gone []uuid.UUID
	for _, rec := range stored {
		if returned[rec.ExternalID] {
			continue
		}
		if rec.TransactionID != uuid.Nil {
			if err := s.ledger.ReleaseRecord(ctx, batch.UserID, rec.ID); err != nil {
				return err
			}
		}
		gone = append(gone, rec.ID)
	}
	batch.Counts.Withdrawn = len(gone)
	return s.repo.WithdrawRecords(ctx, batch.UserID, gone)
}
