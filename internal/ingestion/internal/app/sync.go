package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// SyncConnection syncs every mapped account of a connection, one batch per account (P6
// amendment A36), and records the item status and the outcome on the connection. The
// error stored on the connection names no identifier (A44).
func (s *Service) SyncConnection(ctx context.Context, userID int64, connectionID uuid.UUID) ([]domain.Batch, error) {
	if err := s.available(); err != nil {
		return nil, err
	}
	c, err := s.repo.Connection(ctx, userID, connectionID)
	if err != nil {
		return nil, err
	}
	batches, err := s.syncAccounts(ctx, &c)
	c.LastError = ""
	if err != nil {
		c.LastError = err.Error()
	}
	if markErr := s.repo.MarkConnectionSynced(ctx, c); markErr != nil {
		return batches, errors.Join(err, markErr)
	}
	return batches, err
}

func (s *Service) syncAccounts(ctx context.Context, c *domain.Connection) ([]domain.Batch, error) {
	i, err := s.repo.Integration(ctx, c.UserID, c.IntegrationID)
	if err != nil {
		return nil, err
	}
	creds, err := s.credentials(i)
	if err != nil {
		return nil, err
	}
	var batches []domain.Batch
	for _, ext := range c.Accounts {
		if ext.State() != domain.MappingMapped {
			continue
		}
		b, read, err := s.syncAccount(ctx, *c, ext, creds)
		if err != nil {
			return batches, err
		}
		c.ProviderStatus, c.LastItemUpdateAt = read.ItemStatus, read.ItemUpdatedAt
		batches = append(batches, b)
	}
	return batches, nil
}

// syncAccount reads one mapped account for its window and records it as one batch: lines
// the aggregator stopped returning are withdrawn first, so that a line returned with a new
// id finds its released posting (A38); then the lines go through the P4 pipeline, and a
// bank balance becomes a balance assertion (A42).
func (s *Service) syncAccount(ctx context.Context, c domain.Connection, ext domain.ExternalAccount, creds domain.Credentials) (domain.Batch, domain.AccountRead, error) {
	accountID := *ext.AccountID
	target, err := s.ledger.ImportTarget(ctx, c.UserID, accountID)
	if err != nil {
		return domain.Batch{}, domain.AccountRead{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}
	today := s.today()
	from, to := ext.SyncWindow(today)
	unlock, err := s.repo.LockAccountImports(ctx, accountID)
	if err != nil {
		return domain.Batch{}, domain.AccountRead{}, err
	}
	defer unlock()

	read, err := s.agg.ReadAccount(ctx, c.IntegrationID, creds, c.ItemID, ext.ExternalID, from, to, target.Currency.MinorUnits())
	if err != nil {
		return domain.Batch{}, domain.AccountRead{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}
	batch, err := s.repo.InsertBatch(ctx, domain.Batch{
		UserID: c.UserID, AccountID: accountID, Source: domain.SourceOpenFinance, ExternalAccountID: &ext.ID,
		Currency: string(target.Currency), PeriodFrom: &from, PeriodTo: &to, Balance: domain.FileBalance{Status: domain.BalanceNone},
	})
	if err != nil {
		return domain.Batch{}, read, err
	}
	if err := s.withdraw(ctx, &batch, read.Seen, from, to); err != nil {
		return domain.Batch{}, read, err
	}
	if err := s.importRecords(ctx, &batch, target.Currency, read.Records); err != nil {
		return domain.Batch{}, read, err
	}
	if b := read.Balance; b != nil && !b.Date.After(today) && (ext.Balance == nil || *ext.Balance != *b) {
		batch.Balance = domain.FileBalance{Status: domain.BalanceRecorded, Date: &b.Date, Amount: b.Amount}
		err := s.ledger.AssertSyncedBalance(ctx, c.UserID, accountID, *b, target.Currency)
		switch {
		case errors.Is(err, ErrBalanceRejected):
			batch.Balance.Status, batch.Balance.Reason = domain.BalanceSkipped, err.Error()
		case err != nil:
			return domain.Batch{}, read, err
		}
		ext.Balance = b
	}
	if batch, err = s.repo.CompleteBatch(ctx, batch); err != nil {
		return domain.Batch{}, read, err
	}
	ext.LastSyncedOn = &today
	return batch, read, s.repo.MarkAccountSynced(ctx, ext)
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
