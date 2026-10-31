package server

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// accountNotices composes the accounts the assistant's prompt names from the ledger's open
// differences and the ingestion feeds (P12 A152, ADR 002).
func accountNotices(l *ledger.Module, in *ingestion.Module) func(context.Context, int64) ([]assistant.AccountNotice, error) {
	return func(ctx context.Context, booksID int64) ([]assistant.AccountNotice, error) {
		checks, err := l.AccountChecks(ctx, booksID)
		if err != nil {
			return nil, err
		}

		ids := make([]uuid.UUID, len(checks))
		for i, c := range checks {
			ids[i] = c.ID
		}

		feeds, err := in.FeedStates(ctx, booksID, ids)
		if err != nil {
			return nil, err
		}

		var out []assistant.AccountNotice
		for _, c := range checks {
			f := feeds[c.ID]
			if f.ConnectionState == "" && c.Difference == nil && f.Unconfirmed == 0 {
				continue
			}

			n := assistant.AccountNotice{
				Name:            c.Name,
				ConnectionState: f.ConnectionState,
				Difference:      c.Difference,
				DifferenceOn:    c.DifferenceOn,
				Unconfirmed:     f.Unconfirmed,
			}
			if f.LastUpdate != nil {
				d := clock.DateOf(*f.LastUpdate, clock.Location(ctx))
				n.LastUpdateOn = &d
			}

			out = append(out, n)
		}

		return out, nil
	}
}
