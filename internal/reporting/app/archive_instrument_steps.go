package app

import (
	"encoding/json/jsontext"
	"slices"
)

// addInstrumentSymbols moves a version 12 archive to version 13, which adds
// marketdata_instrument_symbol (migration 00095). Version 12 has no rows for it, so every table
// carries over unchanged.
func addInstrumentSymbols(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addInstrumentOwner writes null into books_id, issuer, issuer_scheme and issuer_id of every version
// 19 row of marketdata_instrument (migration 00104): an instrument saved before is public and has
// no issuer (fixed income complete A236 FC1, FC3).
func addInstrumentOwner(tables []ArchiveTable) ([]ArchiveTable, error) {
	const table = "marketdata_instrument"

	for _, column := range []string{"books_id", "issuer", "issuer_scheme", "issuer_id"} {
		var err error
		if tables, err = withField(tables, table, column, jsontext.Value("null")); err != nil {
			return nil, err
		}
	}

	return tables, nil
}

// addInstrumentHidden moves a version 21 archive to version 22, which adds
// marketdata_instrument_hidden (migration 00107). Version 21 hides no instrument, so every table
// carries over unchanged.
func addInstrumentHidden(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}
