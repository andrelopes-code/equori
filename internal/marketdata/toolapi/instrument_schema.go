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
	Type             manageInstrumentType   `json:"type,omitzero"                jsonschema:"for define: instrument type; edit allows stock, etf, reit, depositary_receipt"`
	QuoteCurrency    string                 `json:"quote_currency,omitzero"      jsonschema:"for define: currency of its prices"`
	Scale            int                    `json:"scale,omitzero"               jsonschema:"for define: decimal places of a quantity"`
	Date             tool.Date              `json:"date,omitzero"                jsonschema:"for record_price: price date"`
	Price            string                 `json:"price,omitzero"               jsonschema:"for record_price: unit price in quote_currency"`
	IssuedOn         tool.Date              `json:"issued_on,omitzero"           jsonschema:"for set_terms: issue date"`
	MaturesOn        tool.Date              `json:"matures_on,omitzero"          jsonschema:"for set_terms: maturity date"`
	FaceValue        string                 `json:"face_value,omitzero"          jsonschema:"for set_terms: face value"`
	IndexID          string                 `json:"index_id,omitzero"            jsonschema:"for set_terms: index id; absent for a fixed rate"`
	PercentOfIndexBP int                    `json:"percent_of_index_bp,omitzero" jsonschema:"for set_terms: percent of the index in bp, 11000 for 110%"`
	SpreadBP         int                    `json:"spread_bp,omitzero"           jsonschema:"for set_terms: annual spread in bp"`
	CalendarID       string                 `json:"calendar_id,omitzero"         jsonschema:"for set_terms: calendar of bus252 days, such as br_banking"`
	DailyLiquidity   bool                   `json:"daily_liquidity,omitzero"     jsonschema:"for set_terms: redeemable any business day"`
	RedeemableFrom   tool.Date              `json:"redeemable_from,omitzero"     jsonschema:"for set_terms: first early redemption date"`
	From             tool.Date              `json:"from,omitzero"                jsonschema:"for request_history: first price date"`

	InterestEveryMonths int       `json:"interest_every_months,omitzero" jsonschema:"for set_terms: interest every 1, 3, 6 or 12 months"`
	FirstPaymentOn      tool.Date `json:"first_payment_on,omitzero"      jsonschema:"for set_terms: first interest date"`

	Exchange string                   `json:"exchange,omitzero"  jsonschema:"for define and edit: ISO 10383 MIC, such as BVMF"`
	Subtype  string                   `json:"subtype,omitzero"   jsonschema:"for define and edit: refines the type, such as cdb or fii_papel"`
	Symbols  []string                 `json:"symbols,omitzero"   jsonschema:"for define and edit: source=symbol entries, such as yahoo=PETR4.SA; an empty list clears them"`
	DayCount manageInstrumentDayCount `json:"day_count,omitzero" jsonschema:"for set_terms: bus252 needs a daily index or calendar_id; follows the index when absent"`

	Issuer       string `json:"issuer,omitzero"        jsonschema:"for edit: issuer name"`
	IssuerScheme string `json:"issuer_scheme,omitzero" jsonschema:"for edit: issuer identifier scheme, such as br_cnpj"`
	IssuerID     string `json:"issuer_id,omitzero"     jsonschema:"for edit: issuer identifier"`
}

type manageInstrumentOut struct {
	Instrument instrumentView `json:"instrument,omitzero"`
	Price      priceView      `json:"price,omitzero"`
	Terms      termsView      `json:"terms,omitzero"`
}
