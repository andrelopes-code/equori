package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

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
