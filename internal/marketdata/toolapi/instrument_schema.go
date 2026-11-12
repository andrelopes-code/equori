package toolapi

import "github.com/andrelopes-code/equori/internal/platform/tool"

type manageInstrumentAction string

func (manageInstrumentAction) Values() []string {
	return []string{
		"define",
		"rename",
		"edit",
		"record_price",
		"set_terms",
		"request_history",
		"delete",
	}
}

type manageInstrumentDayCount string

func (manageInstrumentDayCount) Values() []string { return []string{"bus252", "act365"} }

type manageInstrumentType string

func (manageInstrumentType) Values() []string {
	return []string{
		"currency",
		"stock",
		"etf",
		"reit",
		"depositary_receipt",
		"fixed_income",
		"fund",
		"crypto",
	}
}

type manageInstrumentIn struct {
	Action           manageInstrumentAction `json:"action"                       jsonschema:"operation to propose"`
	Code             string                 `json:"code"                         jsonschema:"instrument code"`
	Name             string                 `json:"name,omitzero"                jsonschema:"for define and rename: instrument name"`
	Type             manageInstrumentType   `json:"type,omitzero"                jsonschema:"for define: instrument type"`
	QuoteCurrency    string                 `json:"quote_currency,omitzero"      jsonschema:"for define: currency the instrument is priced in"`
	Scale            int                    `json:"scale,omitzero"               jsonschema:"for define: decimal places of a quantity"`
	Date             tool.Date              `json:"date,omitzero"                jsonschema:"for record_price: price date"`
	Price            string                 `json:"price,omitzero"               jsonschema:"for record_price: decimal price of one unit in quote_currency"`
	IssuedOn         tool.Date              `json:"issued_on,omitzero"           jsonschema:"for set_terms: issue date"`
	MaturesOn        tool.Date              `json:"matures_on,omitzero"          jsonschema:"for set_terms: maturity date"`
	FaceValue        string                 `json:"face_value,omitzero"          jsonschema:"for set_terms: face value"`
	IndexID          string                 `json:"index_id,omitzero"            jsonschema:"for set_terms: index identifier; absent for a fixed rate"`
	PercentOfIndexBP int                    `json:"percent_of_index_bp,omitzero" jsonschema:"for set_terms: percentage of the index in basis points, 11000 for 110%"`
	SpreadBP         int                    `json:"spread_bp,omitzero"           jsonschema:"for set_terms: annual spread in basis points"`
	From             tool.Date              `json:"from,omitzero"                jsonschema:"for request_history: first date of the prices to load"`

	Exchange string                   `json:"exchange,omitzero"  jsonschema:"for define and edit: ISO 10383 market code, such as BVMF"`
	Subtype  string                   `json:"subtype,omitzero"   jsonschema:"for define and edit: refines the type, such as cdb or fii_papel"`
	Symbols  []string                 `json:"symbols,omitzero"   jsonschema:"for define and edit: source=symbol entries, such as yahoo=PETR4.SA; an empty list on edit clears them"`
	DayCount manageInstrumentDayCount `json:"day_count,omitzero" jsonschema:"for set_terms: bus252 needs a daily index; follows the index when absent"`
}

type manageInstrumentOut struct {
	Instrument instrumentView `json:"instrument,omitzero"`
	Price      priceView      `json:"price,omitzero"`
	Terms      termsView      `json:"terms,omitzero"`
}
