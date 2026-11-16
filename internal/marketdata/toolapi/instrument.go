package toolapi

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func manageInstrument(svc Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_instrument",
		Description: "Proposes defining, renaming or deleting a security for the whole instance, recording a manual price, setting fixed income terms, or loading its price history since a date from the enabled sources. A security in use cannot be deleted. " +
			"Use it when a security or a price is missing. " +
			"Do not use it to buy or sell: record_investment does. " +
			"Instruments and prices are shared by every book; the user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, _ int64, in manageInstrumentIn) (tool.Preview, error) {
		return previewInstrument(ctx, svc, in)
	}, func(ctx context.Context, _ int64, in manageInstrumentIn) (manageInstrumentOut, error) {
		return applyInstrument(ctx, svc, in)
	})
}

func termsText(t domain.Terms) string {
	text := fmt.Sprintf(
		"issued %s, matures %s, index %q at %d bp plus %d bp, %s",
		t.IssuedOn.Format(
			time.DateOnly,
		),
		t.MaturesOn.Format(time.DateOnly),
		t.IndexID,
		t.PercentOfIndexBP,
		t.SpreadBP,
		t.DayCount,
	)

	if t.CalendarID != "" {
		text += ", calendar " + t.CalendarID
	}

	if t.DailyLiquidity {
		text += ", daily liquidity"
	}

	if !t.RedeemableFrom.IsZero() {
		text += ", redeemable from " + t.RedeemableFrom.Format(time.DateOnly)
	}

	return text
}

// symbolsForEdit returns the symbols to send to EditInstrument: nil keeps the stored set.
func (in manageInstrumentIn) symbolsForEdit(after domain.Instrument) map[string]string {
	if in.Symbols == nil {
		return nil
	}

	if after.Symbols == nil {
		return map[string]string{}
	}

	return after.Symbols
}

// instrumentFactChanges lists the exchange, subtype, name and symbols that differ between two states.
func instrumentFactChanges(before, after domain.Instrument) []tool.Change {
	var changes []tool.Change

	text := tool.TextValue
	if before.Name != after.Name && before.Name != "" {
		changes = append(
			changes,
			tool.Change{Field: "name", Before: text(before.Name), After: text(after.Name)},
		)
	}

	if before.Type != after.Type && before.Type != "" {
		changes = append(
			changes,
			tool.Change{Field: "kind", Before: text(before.Type), After: text(after.Type)},
		)
	}

	if before.Exchange != after.Exchange {
		changes = append(
			changes,
			tool.Change{
				Field:  "exchange",
				Before: text(before.Exchange),
				After:  text(after.Exchange),
			},
		)
	}

	if before.Subtype != after.Subtype {
		changes = append(
			changes,
			tool.Change{Field: "subtype", Before: text(before.Subtype), After: text(after.Subtype)},
		)
	}

	if !maps.Equal(before.Symbols, after.Symbols) {
		changes = append(
			changes,
			tool.Change{
				Field:  "symbols",
				Before: text(symbolsText(before.Symbols)),
				After:  text(symbolsText(after.Symbols)),
			},
		)
	}

	return changes
}

// symbolsText renders symbols as source=symbol entries sorted by source.
func symbolsText(m map[string]string) string {
	entries := make([]string, 0, len(m))
	for _, k := range slices.Sorted(maps.Keys(m)) {
		entries = append(entries, k+"="+m[k])
	}

	return strings.Join(entries, ", ")
}
