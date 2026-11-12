package pluggy

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// readReserve reads a reserved balance by its identification: no lines, and a balance of the
// summed amounts in the parent account's currency at the item's last update (A74).
// ErrAccountGone when no account holds it.
func (p Port) readReserve(
	ctx context.Context,
	it client.Item,
	accounts []client.Account,
	identification string,
	scale int,
	out *domain.AccountRead,
) error {
	for _, a := range accounts {
		if a.BankData == nil {
			continue
		}

		for _, r := range a.BankData.ReservedBalances {
			if r.Identification != identification {
				continue
			}

			var err error

			*out = domain.AccountRead{ItemStatus: it.Status}
			if out.ItemUpdatedAt, err = updatedAt(it); err != nil {
				return err
			}

			var (
				total int64
				held  bool
			)
			for _, x := range r.AvailableAmounts {
				if x.CurrencyCode != a.CurrencyCode {
					continue
				}

				amount, err := client.Minor(x.Amount, scale)
				if err != nil {
					held = false
					break
				}

				total += amount
				held = true
			}

			if held && out.ItemUpdatedAt != nil {
				l := out.ItemUpdatedAt.In(clock.Location(ctx))
				out.Balance = &domain.Balance{
					Date:   time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC),
					Amount: total,
				}
			}

			return nil
		}
	}

	return app.ErrAccountGone
}
