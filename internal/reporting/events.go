package reporting

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/reporting/app"
	"github.com/andrelopes-code/equori/internal/reporting/postgres"
)

// rebuildSeries runs in the dispatcher's transaction: the series commits with the delivery.
func rebuildSeries(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	from, err := time.Parse(time.DateOnly, p.Date)
	if err != nil {
		return fmt.Errorf("%s date: %w", e.Type, err)
	}

	if p.PreviousDate != "" {
		prev, err := time.Parse(time.DateOnly, p.PreviousDate)
		if err != nil {
			return fmt.Errorf("%s previous_date: %w", e.Type, err)
		}

		if prev.Before(from) {
			from = prev
		}
	}

	return app.NewService(postgres.NewRepository(tx)).RebuildAccounts(ctx, e.BooksID, p.AccountIDs, from)
}
