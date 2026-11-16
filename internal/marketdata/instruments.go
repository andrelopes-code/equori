package marketdata

import (
	"context"
	"errors"
	"fmt"
	"maps"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
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

	if round, ok := RoundLotCode(in.Exchange, string(in.Code)); ok {
		return Instrument{}, &domain.OddLotCodeError{Code: string(in.Code), RoundLot: round}
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

// DefineOwnInstrument stores a fixed income contract owned by booksID (A236 FC1).
func (m *Module) DefineOwnInstrument(
	ctx context.Context, booksID int64, in Instrument,
) (Instrument, error) {
	if in.Type != domain.TypeFixedIncome {
		return Instrument{}, &domain.FieldError{
			Field:   "type",
			Message: "must be fixed_income for a book's instrument",
		}
	}

	in.BooksID = booksID

	return m.DefineInstrument(ctx, in)
}

// EditInstrument replaces the name, exchange, subtype and issuer of a security, and its type among the
// ReclassifiableTypes; the other fields are immutable (A59, A134, A224). An empty typ keeps the
// stored type. symbols nil keeps the stored symbols; an empty map clears them (plan 2 D19). After
// a change that alters the tax class, or a request that carries typ, the reclassified hook runs.
func (m *Module) EditInstrument(
	ctx context.Context, code, typ, name, exchange, subtype string, symbols map[string]string,
	issuer domain.Issuer,
) (Instrument, error) {
	in, derived, err := m.editInstrument(
		ctx, code, typ, name, exchange, subtype, symbols, issuer,
	)
	if err != nil {
		return Instrument{}, err
	}

	if derived {
		if err := m.reclassified(ctx); err != nil {
			return Instrument{}, fmt.Errorf("rebuild derived rows: %w", err)
		}
	}

	return in, nil
}

// editInstrument stores an edit and reports whether it changed what other modules derive from the
// instrument, so that the caller runs the reclassified hook once.
func (m *Module) editInstrument(
	ctx context.Context, code, typ, name, exchange, subtype string, symbols map[string]string,
	issuer domain.Issuer,
) (Instrument, bool, error) {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return Instrument{}, false, err
	}

	if in.Type == domain.TypeCurrency {
		return Instrument{}, false, &domain.FieldError{Field: "code", Message: "is a currency"}
	}

	old := in

	if in.BooksID != 0 && typ != "" && typ != domain.TypeFixedIncome {
		return Instrument{}, false, &domain.FieldError{
			Field:   "type",
			Message: "a book's instrument stays fixed_income",
		}
	}

	if in, err = in.Reclassify(typ); err != nil {
		return Instrument{}, false, err
	}

	in.Name, in.Exchange, in.Subtype, in.Issuer = name, exchange, subtype, issuer
	if symbols != nil {
		in.Symbols = symbols
	}

	if in, err = in.Validate(); err != nil {
		return Instrument{}, false, err
	}

	if err := m.checkSymbolSources(symbols); err != nil {
		return Instrument{}, false, err
	}

	if err := m.updateInstrument(ctx, in, symbols != nil); err != nil {
		return Instrument{}, false, err
	}

	if in.Exchange != old.Exchange || (symbols != nil && !maps.Equal(symbols, old.Symbols)) {
		m.requestDefaultHistory(ctx, in)
	}

	derived := typ != "" || in.Subtype != old.Subtype || in.Exchange != old.Exchange

	return in, derived, nil
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
		Code:           string(in.Code),
		InstrumentType: in.Type,
		//nolint:gosec // G115: Validate bounds the scale to 0–12
		Scale:         int16(in.Scale),
		Name:          in.Name,
		QuoteCurrency: &quoteCode,
		Exchange:      optional(in.Exchange),
		Subtype:       optional(in.Subtype),
		BooksID:       optionalID(in.BooksID),
		Issuer:        optional(in.Issuer.Name),
		IssuerScheme:  optional(in.Issuer.Scheme),
		IssuerID:      optional(in.Issuer.ID),
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
		InstrumentType: in.Type,
		Name:           in.Name,
		Exchange:       optional(in.Exchange),
		Subtype:        optional(in.Subtype),
		Issuer:         optional(in.Issuer.Name),
		IssuerScheme:   optional(in.Issuer.Scheme),
		IssuerID:       optional(in.Issuer.ID),
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

	if r.BooksID != nil {
		in.BooksID = *r.BooksID
	}

	in.Issuer = domain.Issuer{
		Name:   deref(r.Issuer),
		Scheme: deref(r.IssuerScheme),
		ID:     deref(r.IssuerID),
	}

	return in
}
