package server

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/planning"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// recurringSignals finds the recurring series a proposed purchase joins (spec 2026-11-03 §7).
func recurringSignals(m *planning.Module) func(context.Context, int64, tool.Preview) ([]assistant.Signal, error) {
	return func(ctx context.Context, booksID int64, p tool.Preview) ([]assistant.Signal, error) {
		if p.Action != "record_transaction" && p.Action != "handle_card_purchase" {
			return nil, nil
		}

		probe := planning.RecurringProbe{}

		for _, c := range p.Changes {
			switch c.Field {
			case "payee":
				probe.Payee = c.After.Text
			case "description":
				probe.Description = c.After.Text
			case "account":
				probe.Account = c.After.Text
			case "amount":
				probe.Amount, probe.Currency = c.After.Amount, c.After.Currency
			case "date":
				d, err := time.Parse("2006-01-02", c.After.Date)
				if err != nil {
					return nil, nil
				}

				probe.Date = d
			}
		}

		series, ok, err := m.RecurringFor(ctx, booksID, probe)
		if err != nil || !ok {
			return nil, err
		}

		return []assistant.Signal{{Kind: "recurring", Data: series}}, nil
	}
}
