package marketdata

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// foreignKeyViolation is the SQLSTATE of a row that another table still references.
const foreignKeyViolation = "23503"

func (m *Module) Instrument(ctx context.Context, code string) (Instrument, error) {
	row, err := m.q.GetInstrument(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return Instrument{}, ErrUnknownInstrument
	}

	if err != nil {
		return Instrument{}, err
	}

	symbols, err := m.symbolsByInstrument(ctx)
	if err != nil {
		return Instrument{}, err
	}

	in := toInstrument(row)
	in.Symbols = symbols[row.Code]

	return in, nil
}

func (m *Module) Currencies(ctx context.Context) ([]Instrument, error) {
	return m.ListInstruments(ctx, domain.TypeCurrency)
}

// ListInstruments returns the instruments of type typ, or all of them for "".
func (m *Module) ListInstruments(ctx context.Context, typ string) ([]Instrument, error) {
	var rows []postgres.MarketdataInstrument

	var err error
	if typ == "" {
		rows, err = m.q.ListInstruments(ctx)
	} else {
		rows, err = m.q.ListInstrumentsByType(ctx, typ)
	}

	if err != nil {
		return nil, err
	}

	symbols, err := m.symbolsByInstrument(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]Instrument, len(rows))
	for i, r := range rows {
		out[i] = toInstrument(r)
		out[i].Symbols = symbols[r.Code]
	}

	return out, nil
}

// DefineInstrument stores a security for the whole instance (P8 amendment A59).
func (m *Module) DefineInstrument(ctx context.Context, in Instrument) (Instrument, error) {
	in, err := in.Validate()
	if err != nil {
		return Instrument{}, err
	}

	if err := m.checkSymbolSources(in.Symbols); err != nil {
		return Instrument{}, err
	}

	quote, err := m.Instrument(ctx, string(in.QuoteCurrency))
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && quote.Type != domain.TypeCurrency) {
		return Instrument{}, &domain.FieldError{
			Field:   "quote_currency",
			Message: "must be a currency",
		}
	}

	if err != nil {
		return Instrument{}, err
	}

	if err := m.insertInstrument(ctx, in); err != nil {
		return Instrument{}, err
	}

	m.requestDefaultHistory(ctx, in)

	return in, nil
}

// EditInstrument replaces the name, exchange and subtype of a security; the other fields are
// immutable (A59, A134). symbols nil keeps the stored symbols; an empty map clears them (plan 2 D19).
func (m *Module) EditInstrument(
	ctx context.Context, code, name, exchange, subtype string, symbols map[string]string,
) (Instrument, error) {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return Instrument{}, err
	}

	if in.Type == domain.TypeCurrency {
		return Instrument{}, &domain.FieldError{Field: "code", Message: "is a currency"}
	}

	oldExchange, oldSymbols := in.Exchange, in.Symbols

	in.Name, in.Exchange, in.Subtype = name, exchange, subtype
	if symbols != nil {
		in.Symbols = symbols
	}

	if in, err = in.Validate(); err != nil {
		return Instrument{}, err
	}

	if err := m.checkSymbolSources(symbols); err != nil {
		return Instrument{}, err
	}

	if err := m.updateInstrument(ctx, in, symbols != nil); err != nil {
		return Instrument{}, err
	}

	if in.Exchange != oldExchange || (symbols != nil && !maps.Equal(symbols, oldSymbols)) {
		m.requestDefaultHistory(ctx, in)
	}

	return in, nil
}

// DeleteInstrument removes a security with its prices, terms, history requests and symbols (A223
// RM1). A row of another table that references the code makes the delete fail on its foreign key;
// the transaction then rolls back and the answer is ErrInstrumentInUse (RM3).
func (m *Module) DeleteInstrument(ctx context.Context, code string) error {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return err
	}

	if in.Type == domain.TypeCurrency {
		return &domain.FieldError{Field: "code", Message: "is a currency"}
	}

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)

	if err := m.deleteInstrumentRows(ctx, q, code); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (m *Module) deleteInstrumentRows(ctx context.Context, q *postgres.Queries, code string) error {
	steps := []struct {
		name string
		run  func() error
	}{
		{"prices", func() error { return q.DeleteInstrumentPrices(ctx, code) }},
		{"terms", func() error { return q.DeleteInstrumentTerms(ctx, code) }},
		{"history", func() error { return q.DeleteInstrumentHistory(ctx, code) }},
		{"symbols", func() error { return q.DeleteInstrumentSymbols(ctx, code) }},
	}

	for _, step := range steps {
		if err := step.run(); err != nil {
			return fmt.Errorf("delete instrument %s: %w", step.name, err)
		}
	}

	n, err := q.DeleteInstrument(ctx, code)
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return ErrInstrumentInUse
	}

	if err != nil {
		return fmt.Errorf("delete instrument: %w", err)
	}

	if n == 0 {
		return ErrUnknownInstrument
	}

	return nil
}

// insertInstrument stores the instrument and its symbols in one transaction.
func (m *Module) insertInstrument(ctx context.Context, in Instrument) error {
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	quoteCode := string(in.QuoteCurrency)

	n, err := q.InsertInstrument(ctx, postgres.InsertInstrumentParams{
		Code: string(
			in.Code,
		),
		InstrumentType: in.Type,
		Scale:          int16(in.Scale), //nolint:gosec // G115: Validate bounds the scale to 0–12
		Name:           in.Name,
		QuoteCurrency:  &quoteCode,
		Exchange:       optional(in.Exchange),
		Subtype:        optional(in.Subtype),
	})
	if err != nil {
		return fmt.Errorf("insert instrument: %w", err)
	}

	if n == 0 {
		return ErrInstrumentExists
	}

	if err := storeSymbols(ctx, q, in.Code, in.Symbols); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// updateInstrument replaces the name, exchange and subtype, and the symbols when replaceSymbols is
// set, in one transaction.
func (m *Module) updateInstrument(ctx context.Context, in Instrument, replaceSymbols bool) error {
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)

	n, err := q.UpdateInstrument(ctx, postgres.UpdateInstrumentParams{
		Code: string(
			in.Code,
		),
		Name:     in.Name,
		Exchange: optional(in.Exchange),
		Subtype:  optional(in.Subtype),
	})
	if err != nil {
		return fmt.Errorf("update instrument: %w", err)
	}

	if n == 0 {
		return ErrUnknownInstrument
	}

	if replaceSymbols {
		if err := storeSymbols(ctx, q, in.Code, in.Symbols); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// storeSymbols replaces the symbols of code with symbols, inserted in key order.
func storeSymbols(
	ctx context.Context,
	q *postgres.Queries,
	code money.Currency,
	symbols map[string]string,
) error {
	if err := q.DeleteInstrumentSymbols(ctx, string(code)); err != nil {
		return fmt.Errorf("delete instrument symbols: %w", err)
	}

	for _, source := range slices.Sorted(maps.Keys(symbols)) {
		err := q.InsertInstrumentSymbol(ctx, postgres.InsertInstrumentSymbolParams{
			Instrument: string(code), Source: source, Symbol: symbols[source],
		})
		if err != nil {
			return fmt.Errorf("insert instrument symbol: %w", err)
		}
	}

	return nil
}

// checkSymbolSources accepts a key only when a registered source of that ID reads a symbol.
func (m *Module) checkSymbolSources(symbols map[string]string) error {
	for _, key := range slices.Sorted(maps.Keys(symbols)) {
		reads := slices.ContainsFunc(m.feeds.Sources, func(src feed.Source) bool {
			_, ok := src.(feed.SymbolOverride)
			return ok && src.ID() == key
		})
		if !reads {
			return &domain.FieldError{
				Field:   "symbols." + key,
				Message: "is not a source that reads a symbol",
			}
		}
	}

	return nil
}

// symbolsByInstrument returns the symbols of every instrument: instrument code, then source ID.
func (m *Module) symbolsByInstrument(ctx context.Context) (map[string]map[string]string, error) {
	rows, err := m.q.ListInstrumentSymbols(ctx)
	if err != nil {
		return nil, fmt.Errorf("list instrument symbols: %w", err)
	}

	out := make(map[string]map[string]string)

	for _, r := range rows {
		if out[r.Instrument] == nil {
			out[r.Instrument] = make(map[string]string)
		}

		out[r.Instrument][r.Source] = r.Symbol
	}

	return out, nil
}

func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func toInstrument(r postgres.MarketdataInstrument) Instrument {
	in := Instrument{
		Code:  money.Currency(r.Code),
		Type:  r.InstrumentType,
		Scale: int(r.Scale),
		Name:  r.Name,
	}
	if r.QuoteCurrency != nil {
		in.QuoteCurrency = money.Currency(*r.QuoteCurrency)
	}

	if r.Exchange != nil {
		in.Exchange = *r.Exchange
	}

	if r.Subtype != nil {
		in.Subtype = *r.Subtype
	}

	return in
}
