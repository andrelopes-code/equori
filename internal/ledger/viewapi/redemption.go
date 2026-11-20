package viewapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

type estimateRedemptionOut struct {
	IncomeTax  tool.Money `json:"income_tax"`
	IOF        tool.Money `json:"iof"`
	Net        tool.Money `json:"net"`
	CustodyFee tool.Money `json:"custody_fee"`
}

type redemptionData struct {
	Gross      view.Money `json:"gross"`
	IncomeTax  view.Money `json:"income_tax"`
	IOF        view.Money `json:"iof"`
	CustodyFee view.Money `json:"custody_fee"`
	Net        view.Money `json:"net"`
}

// redemptionView walks a redemption from what the security pays to what reaches the account: the
// gross is the net plus the taxes and the fee the estimate withheld.
func redemptionView(
	outputs []json.RawMessage,
	_ view.Select,
	today time.Time,
) (view.Payload, error) {
	var out estimateRedemptionOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode estimate_redemption output: %w", err)
	}

	d, err := redemptionDataOf(out)
	if err != nil {
		return view.Payload{}, err
	}

	tax := view.Money{Amount: d.Gross.Amount - d.Net.Amount, Currency: d.Net.Currency}

	return view.Payload{
		Title:  view.Text{Key: "assistantView.redemption.title"},
		Window: view.Window{At: today.Format(time.DateOnly)},
		Verdict: view.Text{Key: "assistantView.redemption.verdict", Params: map[string]view.Value{
			"net": view.MoneyValue(d.Net), "tax": view.MoneyValue(tax),
		}},
		Rows: redemptionRows(d),
		Data: d,
	}, nil
}

// redemptionDataOf reads the estimate; an absent part reads zero in the net's currency.
func redemptionDataOf(out estimateRedemptionOut) (redemptionData, error) {
	var d redemptionData

	for _, f := range []struct {
		to  *view.Money
		src tool.Money
	}{{&d.IncomeTax, out.IncomeTax}, {&d.IOF, out.IOF}, {&d.Net, out.Net}, {&d.CustodyFee, out.CustodyFee}} {
		if f.src.Currency == "" {
			continue
		}

		m, err := view.Amount(f.src.Amount, f.src.Currency)
		if err != nil {
			return d, err
		}

		*f.to = m
	}

	cur := d.Net.Currency
	d.IOF.Currency, d.CustodyFee.Currency, d.IncomeTax.Currency = cur, cur, cur
	d.Gross = view.Money{
		Amount:   d.Net.Amount + d.IncomeTax.Amount + d.IOF.Amount + d.CustodyFee.Amount,
		Currency: cur,
	}

	return d, nil
}

func redemptionRows(d redemptionData) view.Table {
	return view.Table{
		Head: []string{"assistantView.col.step", "assistantView.col.value"},
		Rows: [][]view.Value{
			{view.TextValue("assistantView.redemption.gross"), view.MoneyValue(d.Gross)},
			{view.TextValue("assistantView.redemption.income_tax"), view.MoneyValue(d.IncomeTax)},
			{view.TextValue("assistantView.redemption.iof"), view.MoneyValue(d.IOF)},
			{view.TextValue("assistantView.redemption.custody_fee"), view.MoneyValue(d.CustodyFee)},
			{view.TextValue("assistantView.redemption.net"), view.MoneyValue(d.Net)},
		},
	}
}
