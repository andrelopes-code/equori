package app

import (
	"bytes"
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// addMissingAccounts stores, pending, every account and reserved balance the item reports
// that the connection lacks (A73), and the name the item now reports for a stored account
// it renamed; the mapping of a stored account is not changed (A94).
func (s *Service) addMissingAccounts(ctx context.Context, agg Aggregator, c *domain.Connection, creds domain.Credentials) error {
	listed, err := agg.Accounts(ctx, c.IntegrationID, creds, c.ExternalID)
	if err != nil {
		return err
	}

	known := make(map[string]domain.ExternalAccount, len(c.Accounts))
	for _, ext := range c.Accounts {
		known[ext.ExternalID] = ext
	}

	today := s.today(ctx)

	changed, err := s.markGone(ctx, c, listed, today)
	if err != nil {
		return err
	}

	// A212: a name first listed now began after the previous listing.

	var previous *time.Time
	if c.LastSyncedAt != nil {
		d := dateIn(*c.LastSyncedAt, clock.Location(ctx))
		previous = &d
	}

	for _, a := range listed {
		if stored, ok := known[a.ExternalID]; ok {
			digest, listed := holderDigest(a)
			if listed && !bytes.Equal(digest, stored.HolderDigest) {
				if err := s.repo.SetExternalAccountHolder(ctx, c.BooksID, stored.ID, digest); err != nil {
					return err
				}

				changed = true
			}

			if a.Name == stored.Name || a.Name == "" {
				continue
			}

			if err := s.repo.RenameExternalAccount(ctx, c.BooksID, stored.ID, a.Name, previous, today); err != nil {
				return err
			}

			changed = true

			continue
		}

		withHolderDigest(&a)

		a.BooksID, a.ConnectionID, a.NameFrom, a.NameOn = c.BooksID, c.ID, previous, &today
		if err := s.repo.InsertMissingExternalAccount(ctx, a); err != nil {
			return err
		}

		changed = true
	}

	if !changed {
		return nil
	}

	reloaded, err := s.repo.Connection(ctx, c.BooksID, c.ID)
	if err != nil {
		return err
	}

	c.Accounts = reloaded.Accounts

	return nil
}

// syncAccount reads one mapped account for its window, widened by one day on each side
// (A145), and records it as one batch: lines the aggregator stopped returning are withdrawn
// first, unless the read is empty (A146), so that a line returned with a new
// id finds its released posting (A38); then the lines go through the P4 pipeline, and a
// bank balance becomes a balance assertion (A42).
// markGone dates the stored accounts this listing lacks and clears those it holds again (A214).
func (s *Service) markGone(ctx context.Context, c *domain.Connection, listed []domain.ExternalAccount, today time.Time) (bool, error) {
	changed := false

	for _, stored := range c.Accounts {
		held := slices.ContainsFunc(listed, func(a domain.ExternalAccount) bool { return a.ExternalID == stored.ExternalID })
		if held == (stored.GoneSince == nil) {
			continue
		}

		var since *time.Time
		if !held {
			since = &today
		}

		if err := s.repo.SetExternalAccountGone(ctx, c.BooksID, stored.ID, since); err != nil {
			return false, err
		}

		changed = true
	}

	return changed, nil
}

func dateIn(t time.Time, loc *time.Location) time.Time {
	l := t.In(loc)

	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC)
}

// withHolderDigest sets the digest of the holder the aggregator reported (A217).
func withHolderDigest(a *domain.ExternalAccount) {
	a.HolderDigest, _ = holderDigest(*a)
}

// holderDigest returns the digest of the account's reported holder; false without a keyed holder.
func holderDigest(a domain.ExternalAccount) ([]byte, bool) {
	if a.Holder == nil {
		return nil, false
	}

	return domain.PartyDigest(*a.Holder)
}
