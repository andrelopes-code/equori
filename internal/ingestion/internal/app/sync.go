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
	agg, err := s.aggregator(i.Provider)
	if err != nil {
		return nil, err
	}
	state, err := agg.ItemState(ctx, i.ID, creds, c.ItemID)
	if err != nil {
		return nil, err
	}
	status, updatedAt := state.Status, state.UpdatedAt
	c.ProviderStatus, c.NextItemUpdateAt, c.LastError = status, state.NextUpdateAt, ""
	newer := updatedAt != nil && (c.LastItemUpdateAt == nil || updatedAt.After(*c.LastItemUpdateAt))
	if agg.State(status) == domain.StateNeedsOwner || (!force && c.LastSyncedAt != nil && !newer) {
		return nil, nil
	}
	if err := s.addMissingAccounts(ctx, agg, c, creds); err != nil {
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
		b, err := s.syncAccount(ctx, agg, *c, ext, creds)
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
// that the connection lacks (A73), and the name the item now reports for a stored account
// it renamed; the mapping of a stored account is not changed (A94).
func (s *Service) addMissingAccounts(ctx context.Context, agg Aggregator, c *domain.Connection, creds domain.Credentials) error {
	listed, err := agg.Accounts(ctx, c.IntegrationID, creds, c.ItemID)
	if err != nil {
		return err
	}
	known := make(map[string]domain.ExternalAccount, len(c.Accounts))
	for _, ext := range c.Accounts {
		known[ext.ExternalID] = ext
	}
	changed := false
	for _, a := range listed {
		if stored, ok := known[a.ExternalID]; ok {
			if a.Name == stored.Name || a.Name == "" {
				continue
			}
			if err := s.repo.RenameExternalAccount(ctx, c.UserID, stored.ID, a.Name); err != nil {
				return err
			}
			changed = true
			continue
		}
		a.UserID, a.ConnectionID = c.UserID, c.ID
		if err := s.repo.InsertMissingExternalAccount(ctx, a); err != nil {
			return err
		}
		changed = true
	}
	if !changed {
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
func (s *Service) syncAccount(ctx context.Context, agg Aggregator, c domain.Connection, ext domain.ExternalAccount, creds domain.Credentials) (domain.Batch, error) {
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

	// A93: a card's first sync reads back to the cycle that holds sync_from.
	first := target.Kind == cardKind && ext.LastSyncedOn == nil
	readFrom := from
	if first {
		readFrom = from.AddDate(0, 0, -cycleLookback)
	}
	read, err := agg.ReadAccount(ctx, c.IntegrationID, creds, c.ItemID, ext.ExternalID, readFrom, to, target.Currency.MinorUnits())
	if errors.Is(err, ErrAccountGone) && ext.Subtype == domain.SubtypeReservedBalance {
		// A reserved balance the item stopped reporting syncs without a balance (D2).
		read, err = domain.AccountRead{}, nil
	}
	if err != nil {
		return domain.Batch{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}
	read = withoutSuperseded(read)
	for _, r := range read.Records {
		if r.Category != nil {
			r.Category.Aggregator = agg.ID()
		}
	}
	var opening *domain.Bill
	firstDue := *ext.SyncFrom
	if first {
		read, opening, from = fromCycleStart(read, *ext.SyncFrom, from)
		if opening != nil {
			firstDue = opening.Due
		}
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
	// A85: the bills date their statements before the lines are billed by date.
	for _, b := range read.Bills {
		if b.Due.Before(firstDue) {
			continue
		}
		if err := s.ledger.RecordStatementFacts(ctx, c.UserID, accountID, b, target.Currency); err != nil {
			return domain.Batch{}, fmt.Errorf("account %s bill due %s: %w", ext.ID, b.Due.Format(time.DateOnly), err)
		}
	}
	if opening != nil {
		if err := s.ledger.RecordCardOpening(ctx, c.UserID, accountID, *opening, target.Currency); err != nil {
			return domain.Batch{}, fmt.Errorf("account %s opening: %w", ext.ID, err)
		}
	}
	if err := s.importRecords(ctx, &batch, target.Currency, read.Records, s.reserveTransfers(c, ext)); err != nil {
		return domain.Batch{}, err
	}
	if len(read.Bills) > 0 {
		if err := s.ledger.SettleReportedStatements(ctx, c.UserID, accountID); err != nil {
			return domain.Batch{}, err
		}
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

const (
	cardKind = "credit_card"
	// cycleLookback reaches the closing of the bill before sync_from on a first card sync.
	cycleLookback = 40
	// closingMargin keeps the unbilled lines a calendar shift may place before a reported closing.
	closingMargin = 7
)

// fromCycleStart keeps, on a card's first sync, the lines of the bills due after the last
// bill closed before syncFrom and the unbilled lines from that bill's closing on, and
// returns that bill, which opens the card (A93). Without such a bill the read keeps the
// lines from syncFrom.
func fromCycleStart(read domain.AccountRead, syncFrom, from time.Time) (domain.AccountRead, *domain.Bill, time.Time) {
	var prev *domain.Bill
	for i, b := range read.Bills {
		closed := b.Due
		if b.Closing != nil {
			closed = *b.Closing
		}
		if closed.Before(syncFrom) && (prev == nil || b.Due.After(prev.Due)) {
			prev = &read.Bills[i]
		}
	}
	start := syncFrom
	if prev != nil {
		start = prev.Due.AddDate(0, 0, -closingMargin)
		if prev.Closing != nil {
			start = prev.Closing.AddDate(0, 0, -closingMargin)
		}
	}
	var kept []domain.NormalizedRecord
	for _, r := range read.Records {
		switch {
		case r.DueDate != nil && prev != nil:
			if r.DueDate.After(prev.Due) {
				kept = append(kept, r)
			}
		case !r.Date.Before(start):
			kept = append(kept, r)
		}
	}
	read.Records = kept
	if start.Before(from) {
		from = start
	}
	return read, prev, from
}

// withoutSuperseded drops the pending lines that a posted line of the same read replaces:
// a stored one is then withdrawn and its transaction waits for the posted line (A91).
func withoutSuperseded(read domain.AccountRead) domain.AccountRead {
	gone := domain.Superseded(read.Records)
	if len(gone) == 0 {
		return read
	}
	dropped := map[string]bool{}
	var kept []domain.NormalizedRecord
	for i, r := range read.Records {
		if gone[i] {
			dropped[r.ExternalID] = true
			continue
		}
		kept = append(kept, r)
	}
	read.Records = kept
	read.Seen = slices.DeleteFunc(slices.Clone(read.Seen), func(id string) bool { return dropped[id] })
	return read
}

// reserveTransfers resolves the reserve a bank line moves money into or out of from the
// reserve's name (A76), or from a former name that no mapped reserve holds as its current one
// (A94). A name held by two mapped reserves at the same rank is ambiguous and resolves to
// none, and so does a line dated before the reserve's start date.
func (s *Service) reserveTransfers(c domain.Connection, ext domain.ExternalAccount) func(domain.NormalizedRecord) *uuid.UUID {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return nil
	}
	var reserves []domain.ExternalAccount
	for _, x := range c.Accounts {
		if x.Subtype == domain.SubtypeReservedBalance && x.State() == domain.MappingMapped {
			reserves = append(reserves, x)
		}
	}
	byName := reserveNames(reserves, func(x domain.ExternalAccount) []string { return []string{x.Name} })
	former := reserveNames(reserves, func(x domain.ExternalAccount) []string { return x.FormerNames })
	for name, x := range former {
		if _, current := byName[name]; !current {
			byName[name] = x
		}
	}
	return func(r domain.NormalizedRecord) *uuid.UUID {
		reserve, ok := byName[r.ReserveName]
		if r.ReserveName == "" || !ok || reserve.AccountID == nil || r.Date.Before(*reserve.SyncFrom) {
			return nil
		}
		return reserve.AccountID
	}
}

// reserveNames indexes the reserves by the names names returns; a name two reserves hold
// maps to the zero account, which resolves to none.
func reserveNames(reserves []domain.ExternalAccount, names func(domain.ExternalAccount) []string) map[string]domain.ExternalAccount {
	out := map[string]domain.ExternalAccount{}
	for _, x := range reserves {
		for _, name := range names(x) {
			if held, dup := out[name]; dup && held.ID != x.ID {
				out[name] = domain.ExternalAccount{}
				continue
			}
			out[name] = x
		}
	}
	return out
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
