package marketdata

import (
	"context"
	"errors"
	"time"
)

// ResolveCode returns the round-lot instrument of an odd-lot code when one is known (A228 IO4),
// else code.
func (m *Module) ResolveCode(ctx context.Context, code string) (string, error) {
	for _, mic := range oddLotExchanges {
		round, ok := RoundLotCode(mic, code)
		if !ok {
			continue
		}

		in, err := m.Instrument(ctx, round)
		if errors.Is(err, ErrUnknownInstrument) {
			continue
		}

		if err != nil {
			return "", err
		}

		if in.Exchange == mic {
			return round, nil
		}
	}

	return code, nil
}

// SettlementDate returns the date a trade of code made on date settles (A228 IO7).
func (m *Module) SettlementDate(
	ctx context.Context,
	code string,
	date time.Time,
) (time.Time, error) {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return time.Time{}, err
	}

	days, calendar, ok := SettlementCycle(in.Exchange, date)
	if !ok {
		return date, nil
	}

	settled := date
	for range days {
		settled, err = m.Adjust(ctx, calendar, settled.AddDate(0, 0, 1), AdjustFollowing)
		if err != nil {
			return time.Time{}, err
		}
	}

	return settled, nil
}
