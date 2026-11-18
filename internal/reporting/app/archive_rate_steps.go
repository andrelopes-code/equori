package app

import "encoding/json/jsontext"

// addRateSteps moves a version 29 archive to version 30. It writes an empty rate_steps and a null
// rate_steps_apply into every row of marketdata_fixed_income_terms (migration 00128): terms saved
// before keep one rate (progressive rate design PR3). It also writes a null new_account_id and
// cost_bp into a row of ledger_corporate_action that lacks them: migration 00125 added both
// columns within version 29, so an archive of that version holds them or not (coverage row E-07).
func addRateSteps(tables []ArchiveTable) ([]ArchiveTable, error) {
	const terms = "marketdata_fixed_income_terms"

	tables, err := withField(tables, terms, "rate_steps", jsontext.Value("[]"))
	if err != nil {
		return nil, err
	}

	if tables, err = withField(
		tables,
		terms,
		"rate_steps_apply",
		jsontext.Value("null"),
	); err != nil {
		return nil, err
	}

	return editRows(tables, "ledger_corporate_action", func(fields map[string]jsontext.Value) {
		for _, column := range []string{"new_account_id", "cost_bp"} {
			if _, ok := fields[column]; !ok {
				fields[column] = jsontext.Value("null")
			}
		}
	})
}
