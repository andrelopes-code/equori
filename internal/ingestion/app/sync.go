package app

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

const (
	cardKind = "credit_card"
	// cycleLookback reaches the closing of the bill before sync_from on a first card sync.
	cycleLookback = 40
	// closingMargin keeps the unbilled lines a calendar shift may place before a reported closing.
	closingMargin = 7
)

// SyncConnection syncs every mapped account of a connection now, one batch per account (P6
// amendments A36, A43).
func (s *Service) SyncConnection(
	ctx context.Context,
	booksID int64,
	connectionID uuid.UUID,
) (domain.Connection, []domain.Batch, error) {
	if err := s.available(); err != nil {
		return domain.Connection{}, nil, err
	}

	return s.sync(ctx, booksID, connectionID, true)
}

// sync reads the item and, unless it is blocked or, without force, has no data newer than
// the last sync, syncs the mapped accounts. The connection stores the item status and the
// outcome; its error names no identifier (A44).
func (s *Service) sync(
	ctx context.Context,
	booksID int64,
	connectionID uuid.UUID,
	force bool,
) (domain.Connection, []domain.Batch, error) {
	c, err := s.repo.Connection(ctx, booksID, connectionID)
	if err != nil {
		return domain.Connection{}, nil, err
	}

	batches, err := s.syncItem(ctx, &c, force)
	if err != nil {
		c.LastError = err.Error()
	}

	if stateErr := s.withState(ctx, &c, map[uuid.UUID]Aggregator{}); stateErr != nil {
		err = errors.Join(err, stateErr)
	}

	if saveErr := s.repo.SaveConnectionState(ctx, c); saveErr != nil {
		return c, batches, errors.Join(err, saveErr)
	}

	if errors.Is(err, ErrAggregatorUnauthorized) {
		err = &UnauthorizedError{Field: "integration_id"}
	}

	return c, batches, err
}

func (s *Service) syncItem(
	ctx context.Context,
	c *domain.Connection,
	force bool,
) ([]domain.Batch, error) {
	i, err := s.repo.Integration(ctx, c.BooksID, c.IntegrationID)
	if err != nil {
		return nil, err
	}

	creds, err := s.credentials(i)
	if err != nil {
		return nil, err
	}

	agg, err := s.aggregator(i.Aggregator)
	if err != nil {
		return nil, err
	}

	state, err := agg.ItemState(ctx, i.ID, creds, c.ExternalID)
	if err != nil {
		return nil, err
	}

	status, updatedAt := state.Status, state.UpdatedAt
	c.ProviderStatus, c.NextItemUpdateAt, c.ConsentExpiresAt, c.LastError = status, state.NextUpdateAt, state.ConsentExpiresAt, ""

	newer := updatedAt != nil && (c.LastItemUpdateAt == nil || updatedAt.After(*c.LastItemUpdateAt))
	if c.StateAt(agg.State(status), s.now()) == domain.StateNeedsOwner ||
		(!force && c.LastSyncedAt != nil && !newer) {
		return nil, nil
	}

	if err := s.addMissingAccounts(ctx, agg, c, creds); err != nil {
		return nil, err
	}

	syncID := uuid.Must(uuid.NewV7())

	batches, err := s.syncMapped(ctx, agg, c, creds, syncID)
	if err != nil {
		return batches, err
	}

	now := s.now()
	c.LastSyncedAt, c.LastItemUpdateAt = &now, updatedAt

	return batches, nil
}

func (s *Service) syncMapped(
	ctx context.Context,
	agg Aggregator,
	c *domain.Connection,
	creds domain.Credentials,
	syncID uuid.UUID,
) ([]domain.Batch, error) {
	var batches []domain.Batch
	// Reserved balances sync after the other accounts, so that the transfers the lines of a
	// bank account book come before the reserve assertion (A74).
	ordered := slices.SortedStableFunc(
		slices.Values(c.Accounts),
		func(a, b domain.ExternalAccount) int {
			return cmp.Compare(reserveRank(a), reserveRank(b))
		},
	)
	for _, ext := range ordered {
		if ext.State() != domain.MappingMapped {
			continue
		}

		// A214: an account the item stopped listing does not stop the others; a reserved balance
		// syncs without a balance (D2).
		if ext.GoneSince != nil && ext.Subtype != domain.SubtypeReservedBalance {
			continue
		}

		b, err := s.syncAccount(ctx, agg, *c, ext, creds, syncID)
		if errors.Is(err, ErrAccountGone) {
			if err := s.repo.SetExternalAccountGone(
				ctx,
				c.BooksID,
				ext.ID,
				new(s.today(ctx)),
			); err != nil {
				return batches, err
			}

			continue
		}

		if err != nil {
			return batches, err
		}

		batches = append(batches, b)
	}

	return batches, nil
}

func (s *Service) syncAccount(
	ctx context.Context,
	agg Aggregator,
	c domain.Connection,
	ext domain.ExternalAccount,
	creds domain.Credentials,
	syncID uuid.UUID,
) (domain.Batch, error) {
	accountID := *ext.AccountID

	target, err := s.ledger.ImportTarget(ctx, c.BooksID, accountID)
	if err != nil {
		return domain.Batch{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}

	today := s.today(ctx)
	from, to, deep := ext.SyncWindow(today)

	unlockBook, err := s.repo.LockBookPairing(ctx, c.BooksID)
	if err != nil {
		return domain.Batch{}, err
	}
	defer unlockBook()

	unlock, err := s.repo.LockAccountImports(ctx, accountID)
	if err != nil {
		return domain.Batch{}, err
	}
	defer unlock()

	ar, err := s.readAccount(ctx, agg, c, ext, creds, target, from, to)
	if err != nil {
		return domain.Batch{}, err
	}

	batch, err := s.importAccountRead(ctx, c, ext, target, ar, to, syncID)
	if err != nil {
		return domain.Batch{}, err
	}

	if b := ar.read.Balance; b != nil && !b.Date.After(today) {
		if err := s.assertAccountBalance(ctx, c, &ext, &batch, target, b); err != nil {
			return domain.Batch{}, err
		}
	}

	if batch, err = s.repo.CompleteBatch(ctx, batch); err != nil {
		return domain.Batch{}, err
	}

	ext.LastSyncedOn = &today
	ext.LastReadAt = &ar.readStart

	if deep {
		ext.LastDeepReadOn = &today
	}

	return batch, s.repo.MarkAccountSynced(ctx, ext)
}

// accountRead is what one account read returns, narrowed to the sync window.
type accountRead struct {
	read      domain.AccountRead
	from      time.Time
	opening   *domain.Bill
	firstDue  time.Time
	readStart time.Time
}

func (s *Service) readAccount(
	ctx context.Context,
	agg Aggregator,
	c domain.Connection,
	ext domain.ExternalAccount,
	creds domain.Credentials,
	target domain.ImportTarget,
	from, to time.Time,
) (accountRead, error) {
	// A93: a card's first sync reads back to the cycle that holds sync_from.
	first := target.Kind == cardKind && ext.LastSyncedOn == nil

	readFrom := from
	if first {
		readFrom = from.AddDate(0, 0, -cycleLookback)
	}

	createdFrom := createdSince(ext)

	readStart := s.now()

	read, err := agg.ReadAccount(
		ctx, c.IntegrationID, creds, c.ExternalID, ext.ExternalID,
		readFrom.AddDate(0, 0, -1), to.AddDate(0, 0, 1), createdFrom, target.Currency.MinorUnits(),
	)
	if errors.Is(err, ErrAccountGone) && ext.Subtype == domain.SubtypeReservedBalance {
		// A reserved balance the item stopped reporting syncs without a balance (D2).
		read, err = domain.AccountRead{}, nil
	}

	if err != nil {
		return accountRead{}, fmt.Errorf("account %s: %w", ext.ID, err)
	}

	read = withoutSuperseded(withCreated(read, *ext.SyncFrom))
	if !first {
		read = fromSyncStart(read, *ext.SyncFrom)
	}

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

	return accountRead{
		read: read, from: from, opening: opening, firstDue: firstDue, readStart: readStart,
	}, nil
}

func (s *Service) importAccountRead(
	ctx context.Context,
	c domain.Connection,
	ext domain.ExternalAccount,
	target domain.ImportTarget,
	ar accountRead,
	to time.Time,
	syncID uuid.UUID,
) (domain.Batch, error) {
	accountID, read, from := *ext.AccountID, ar.read, ar.from

	batch, err := s.repo.InsertBatch(ctx, domain.Batch{
		BooksID:           c.BooksID,
		AccountID:         accountID,
		Source:            domain.SourceAggregator,
		ExternalAccountID: &ext.ID,
		SyncID:            syncID,
		Currency: string(
			target.Currency,
		),
		PeriodFrom: &from,
		PeriodTo:   &to,
		Balance:    domain.FileBalance{Status: domain.BalanceNone},
	})
	if err != nil {
		return domain.Batch{}, err
	}

	if err := s.reidentify(ctx, &batch, read); err != nil {
		return domain.Batch{}, err
	}

	if err := s.withdraw(ctx, &batch, read.Seen, from, to); err != nil {
		return domain.Batch{}, err
	}

	// A85: the bills date their statements before the lines are billed by date.
	for _, b := range read.Bills {
		if b.Due.Before(ar.firstDue) {
			continue
		}

		if err := s.ledger.RecordStatementFacts(
			ctx,
			c.BooksID,
			accountID,
			b,
			target.Currency,
		); err != nil {
			return domain.Batch{}, fmt.Errorf(
				"account %s bill due %s: %w",
				ext.ID,
				b.Due.Format(time.DateOnly),
				err,
			)
		}
	}

	if ar.opening != nil {
		if err := s.ledger.RecordCardOpening(
			ctx,
			c.BooksID,
			accountID,
			*ar.opening,
			target.Currency,
		); err != nil {
			return domain.Batch{}, fmt.Errorf("account %s opening: %w", ext.ID, err)
		}
	}

	if err := s.importRecords(
		ctx,
		&batch,
		target.Currency,
		read.Records,
		s.reserveTransfers(c, ext),
	); err != nil {
		return domain.Batch{}, err
	}

	if len(read.Bills) > 0 {
		if err := s.ledger.SettleReportedStatements(ctx, c.BooksID, accountID); err != nil {
			return domain.Batch{}, err
		}
	}

	return batch, nil
}

func (s *Service) assertAccountBalance(
	ctx context.Context,
	c domain.Connection,
	ext *domain.ExternalAccount,
	batch *domain.Batch,
	target domain.ImportTarget,
	b *domain.Balance,
) error {
	// The ledger decides an open assertion of this balance again on every sync (A77).
	if ext.Balance == nil || *ext.Balance != *b {
		batch.Balance = domain.FileBalance{
			Status: domain.BalanceRecorded,
			Date:   &b.Date,
			Amount: b.Amount,
		}
	}

	assert := s.ledger.AssertSyncedBalance
	if ext.Subtype == domain.SubtypeReservedBalance {
		open, err := s.repo.OpenReserveReviews(ctx, c.BooksID, c.ID)
		if err != nil {
			return err
		}

		// A213: while a line may be this reserve's movement, its difference is not yield.
		if open == 0 {
			assert = s.ledger.AssertSyncedReserve
		}
	}

	err := assert(ctx, c.BooksID, *ext.AccountID, *b, target.Currency)
	switch {
	case errors.Is(err, ErrBalanceRejected):
		if batch.Balance.Status == domain.BalanceRecorded {
			batch.Balance.Status, batch.Balance.Reason = domain.BalanceSkipped, err.Error()
		}
	case err != nil:
		return err
	}

	ext.Balance = b

	return nil
}

func reserveRank(ext domain.ExternalAccount) int {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return 1
	}

	return 0
}

func createdSince(ext domain.ExternalAccount) *time.Time {
	var createdFrom *time.Time

	if ext.LastReadAt != nil {
		since := ext.LastReadAt.Add(-domain.CreatedMargin)
		createdFrom = &since
	}

	return createdFrom
}
