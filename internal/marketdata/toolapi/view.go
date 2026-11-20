package toolapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type institutionRow struct {
	// basel, principal_capital or fixed_asset.
	Kind    string `json:"kind"`
	ValueBP int64  `json:"value_bp"`
	// The regulatory minimum with its buffer; absent when the source gives none (R2).
	LimitBP *int64 `json:"limit_bp,omitempty"`
}

type institutionData struct {
	Name   string           `json:"name"`
	Period string           `json:"period"`
	Source string           `json:"source"`
	Rows   []institutionRow `json:"rows"`
}

type pricePoint struct {
	Date  string `json:"date"`
	Value string `json:"value"`
}

type priceData struct {
	Points   []pricePoint `json:"points"`
	ChangeBP int64        `json:"change_bp"`
}

// Views returns the builders of the market data reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "get_institution_indicators", Form: "institution"}: institutionView,
		{Tool: "get_market_data", Form: "price"}:                  priceFormView,
	}
}

// fractionBP reads a decimal fraction ("0.155") as basis points, rounded half away from zero; ok
// is false for an empty or unreadable text.
func fractionBP(s string) (int64, bool) {
	r, ok := new(big.Rat).SetString(s)
	if s == "" || !ok {
		return 0, false
	}

	return ratBP(r), true
}

// ratBP is r in basis points, rounded half away from zero with integer arithmetic.
func ratBP(r *big.Rat) int64 {
	num := new(big.Int).Mul(r.Num(), big.NewInt(20000))
	num.Add(num, new(big.Int).Mul(big.NewInt(int64(r.Sign())), r.Denom()))

	return new(big.Int).Quo(num, new(big.Int).Mul(r.Denom(), big.NewInt(2))).Int64()
}

// institutionView compares the latest quarter's prudential ratios with their minimums.
func institutionView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out getInstitutionIndicatorsOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_institution_indicators output: %w", err)
	}

	if len(out.Periods) == 0 {
		return view.Payload{}, errors.New("the read holds no quarter")
	}

	p := out.Periods[0]
	data := institutionData{
		Name:   out.ConglomerateName,
		Period: p.Period.Format(time.DateOnly),
		Source: out.Source,
		Rows:   institutionRows(p, out),
	}

	return view.Payload{
		Title: view.Text{
			Key:    "assistantView.institution.title",
			Params: map[string]view.Value{"name": view.TextValue(out.ConglomerateName)},
		},
		Window:  view.Window{At: data.Period},
		Verdict: institutionVerdict(data.Rows),
		Prov: &view.Text{
			Key:    "assistantView.prov.source",
			Params: map[string]view.Value{"source": view.TextValue(out.Source)},
		},
		Rows: institutionTable(data.Rows),
		Data: data,
	}, nil
}

// institutionRows reads the ratios of a quarter; a ratio the source leaves out is left out.
func institutionRows(p institutionPeriodView, out getInstitutionIndicatorsOut) []institutionRow {
	rows := []institutionRow{}
	for _, r := range []struct{ kind, value, limit string }{
		{"basel", p.Basel, out.BaselWithBuffer},
		{"principal_capital", p.PrincipalCapital, out.PrincipalCapitalWithBuffer},
		{"fixed_asset", p.FixedAsset, ""},
	} {
		v, ok := fractionBP(r.value)
		if !ok {
			continue
		}

		row := institutionRow{Kind: r.kind, ValueBP: v}
		if l, ok := fractionBP(r.limit); ok {
			row.LimitBP = &l
		}

		rows = append(rows, row)
	}

	return rows
}

func institutionTable(rows []institutionRow) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.indicator",
			"assistantView.col.value",
			"assistantView.col.minimum",
		},
		Rows: [][]view.Value{},
	}
	for _, r := range rows {
		limit := view.TextValue("")
		if r.LimitBP != nil {
			limit = view.RateValue(*r.LimitBP)
		}

		t.Rows = append(t.Rows, []view.Value{
			view.TextValue("assistantView.institution." + r.Kind), view.RateValue(r.ValueBP), limit,
		})
	}

	return t
}

// institutionVerdict names the ratio closest to its minimum and its margin.
func institutionVerdict(rows []institutionRow) view.Text {
	var tight *institutionRow

	for i, r := range rows {
		if r.LimitBP != nil &&
			(tight == nil || r.ValueBP-*r.LimitBP < tight.ValueBP-*tight.LimitBP) {
			tight = &rows[i]
		}
	}

	if tight == nil {
		return view.Text{Key: "assistantView.institution.verdict_none"}
	}

	key := "assistantView.institution.verdict_above"

	gap := tight.ValueBP - *tight.LimitBP
	if gap < 0 {
		key, gap = "assistantView.institution.verdict_below", -gap
	}

	return view.Text{Key: key, Params: map[string]view.Value{
		"name": view.TextValue("assistantView.institution." + tight.Kind),
		"gap":  view.PointsValue(gap),
	}}
}

// priceFormView draws the prices of one instrument over the read's dates and their change.
func priceFormView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out getMarketDataOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_market_data output: %w", err)
	}

	if len(out.Prices) < 2 {
		return view.Payload{}, fmt.Errorf(
			"the read holds %d prices; read a period with prices",
			len(out.Prices),
		)
	}

	data := priceData{Points: []pricePoint{}, ChangeBP: priceChange(out.Prices)}
	rows := view.Table{
		Head: []string{"assistantView.col.date", "assistantView.col.price"},
		Rows: [][]view.Value{},
	}

	for _, p := range out.Prices {
		day := p.Date.Format(time.DateOnly)
		data.Points = append(data.Points, pricePoint{Date: day, Value: p.Value})
		rows.Rows = append(rows.Rows, []view.Value{view.DateValue(day), view.DecimalValue(p.Value)})
	}

	last := data.Points[len(data.Points)-1]

	return view.Payload{
		Title: view.Text{
			Key:    "assistantView.price.title",
			Params: map[string]view.Value{"code": view.TextValue(out.Instrument.Code)},
		},
		Window: view.Window{From: data.Points[0].Date, To: last.Date},
		Verdict: view.Text{Key: "assistantView.price.verdict", Params: map[string]view.Value{
			"change": view.RateValue(data.ChangeBP), "last": view.DecimalValue(last.Value),
		}},
		Rows: rows,
		Data: data,
	}, nil
}

// priceChange is the change from the first price to the last, in basis points.
func priceChange(prices []priceView) int64 {
	first, ok1 := new(big.Rat).SetString(prices[0].Value)

	last, ok2 := new(big.Rat).SetString(prices[len(prices)-1].Value)
	if !ok1 || !ok2 || first.Sign() == 0 {
		return 0
	}

	return ratBP(new(big.Rat).Quo(new(big.Rat).Sub(last, first), first))
}
