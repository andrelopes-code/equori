package app

import "encoding/json/jsontext"

// addExchangeRates moves a version 38 archive to version 39, which adds exchange_rate to
// ledger_trade and ledger_investment_income (migration 00162, foreign cash FC13, FC22). No earlier
// version paid a trade or an income in another currency, so the rate is null.
func addExchangeRates(tables []ArchiveTable) ([]ArchiveTable, error) {
	tables, err := withField(tables, "ledger_trade", "exchange_rate", jsontext.Value("null"))
	if err != nil {
		return nil, err
	}

	return withField(tables, "ledger_investment_income", "exchange_rate", jsontext.Value("null"))
}
