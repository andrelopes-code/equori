package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type probeQuoteIn struct {
	Code          string               `json:"code"              jsonschema:"code of the security, such as a ticker"`
	Type          manageInstrumentType `json:"type"              jsonschema:"instrument type; a currency is not probed"`
	QuoteCurrency string               `json:"quote_currency"    jsonschema:"currency the price is quoted in"`
	Exchange      string               `json:"exchange,omitzero" jsonschema:"market identifier code of the exchange, such as BVMF or XETR"`
	Symbols       []string             `json:"symbols,omitzero"  jsonschema:"entries written source=symbol, such as yahoo=PETR4.SA, when the symbol at a source differs from the code"`
}

type probeQuoteView struct {
	Source string    `json:"source"`
	Date   tool.Date `json:"date,omitzero"  jsonschema:"absent when the source gave no quote"`
	Value  string    `json:"value,omitzero"`
	Error  string    `json:"error,omitzero" jsonschema:"why the source gave no quote"`
}

type probeQuoteOut struct {
	Quotes    []probeQuoteView `json:"quotes"    jsonschema:"one per enabled source that covers the security"`
	Available []string         `json:"available" jsonschema:"sources that cover the security and are disabled on this instance"`
}

func probeQuote(svc Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "probe_quote",
		Description: "Asks each enabled price source for the latest quote of a security that is not defined yet; nothing is stored. " +
			"Use it before manage_instrument define, to check that the code, the exchange and the currency give a price. " +
			"Do not use it for a defined security: get_market_data reads its prices.",
		Effect: tool.ReadOnly,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, _ int64, in probeQuoteIn) (probeQuoteOut, error) {
		symbols, err := symbolMap(in.Symbols)
		if err != nil {
			return probeQuoteOut{}, err
		}

		res, err := svc.ProbeQuote(ctx, domain.Instrument{
			Code:          money.Currency(in.Code),
			Type:          string(in.Type),
			QuoteCurrency: money.Currency(in.QuoteCurrency),
			Exchange:      in.Exchange,
			Symbols:       symbols,
		})
		if err != nil {
			return probeQuoteOut{}, err
		}

		out := probeQuoteOut{
			Quotes:    make([]probeQuoteView, len(res.Quotes)),
			Available: res.Available,
		}
		if out.Available == nil {
			out.Available = []string{}
		}

		for i, q := range res.Quotes {
			out.Quotes[i] = probeQuoteView{Source: q.Source, Error: q.Error}
			if q.Date != nil {
				out.Quotes[i].Date = tool.DateOf(*q.Date)
				out.Quotes[i].Value = q.Value.Reduced().String()
			}
		}

		return out, nil
	})
}

type getInstitutionIndicatorsIn struct {
	Scheme     string `json:"scheme"     jsonschema:"identifier scheme of the institution, from list_payees_and_tags kind identifier_schemes, such as br_ispb"`
	Identifier string `json:"identifier" jsonschema:"identifier of the institution under the scheme"`
}

type institutionPeriodView struct {
	Period           tool.Date  `json:"period"                     jsonschema:"last day of the quarter"`
	Basel            string     `json:"basel,omitzero"             jsonschema:"Basel ratio as a decimal fraction: 0.155 is 15.5%; absent when the source reports none"`
	PrincipalCapital string     `json:"principal_capital,omitzero" jsonschema:"principal capital ratio as a decimal fraction"`
	FixedAsset       string     `json:"fixed_asset,omitzero"       jsonschema:"fixed asset ratio as a decimal fraction"`
	Equity           tool.Money `json:"equity,omitzero"`
	NetIncome        tool.Money `json:"net_income,omitzero"`
}

type getInstitutionIndicatorsOut struct {
	Source                     string                  `json:"source"`
	SourceURL                  string                  `json:"source_url"`
	ConglomerateCode           string                  `json:"conglomerate_code,omitzero"`
	ConglomerateName           string                  `json:"conglomerate_name,omitzero"    jsonschema:"whose figures these are: the prudential conglomerate of the institution"`
	Rule                       string                  `json:"rule"                          jsonschema:"norm that sets the minimums"`
	BaselMinimum               string                  `json:"basel_minimum"`
	BaselWithBuffer            string                  `json:"basel_with_buffer"             jsonschema:"minimum plus the conservation buffer"`
	PrincipalCapitalMinimum    string                  `json:"principal_capital_minimum"`
	PrincipalCapitalWithBuffer string                  `json:"principal_capital_with_buffer"`
	Periods                    []institutionPeriodView `json:"periods"                       jsonschema:"quarters, newest first"`
}

func getInstitutionIndicators(svc Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_institution_indicators",
		Description: "Returns the prudential indicators a regulator publishes for a financial institution: Basel ratio, principal capital, fixed asset ratio, equity and net income by quarter, with the regulatory minimums. " +
			"Use it when the user asks how solid a bank or an issuer of fixed income is. " +
			"The figures state facts and are no recommendation; an institution the source does not report is not_found. " +
			"Do not use it for the deposit guarantee: get_portfolio view issuer_exposure does.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, _ int64, in getInstitutionIndicatorsIn) (getInstitutionIndicatorsOut, error) {
		x, err := svc.InstitutionIndicators(ctx, in.Scheme, in.Identifier)
		if err != nil {
			return getInstitutionIndicatorsOut{}, err
		}

		out := getInstitutionIndicatorsOut{
			Source:                     x.Source,
			SourceURL:                  x.SourceURL,
			ConglomerateCode:           x.ConglomerateCode,
			ConglomerateName:           x.ConglomerateName,
			Rule:                       x.Limits.Rule,
			BaselMinimum:               x.Limits.Basel.Minimum,
			BaselWithBuffer:            x.Limits.Basel.WithBuffer,
			PrincipalCapitalMinimum:    x.Limits.PrincipalCapital.Minimum,
			PrincipalCapitalWithBuffer: x.Limits.PrincipalCapital.WithBuffer,
			Periods:                    make([]institutionPeriodView, len(x.Periods)),
		}
		for i, p := range x.Periods {
			if out.Periods[i], err = institutionPeriod(p, x.Currency); err != nil {
				return getInstitutionIndicatorsOut{}, err
			}
		}

		return out, nil
	})
}

func institutionPeriod(p domain.InstitutionPeriod, currency string) (institutionPeriodView, error) {
	v := institutionPeriodView{Period: tool.DateOf(p.Period)}

	for _, f := range []struct {
		from *string
		into *string
	}{{p.Basel, &v.Basel}, {p.PrincipalCapital, &v.PrincipalCapital}, {p.FixedAsset, &v.FixedAsset}} {
		if f.from != nil {
			*f.into = *f.from
		}
	}

	for _, f := range []struct {
		from *int64
		into *tool.Money
	}{{p.Equity, &v.Equity}, {p.NetIncome, &v.NetIncome}} {
		if f.from == nil {
			continue
		}

		m, err := money.New(*f.from, money.Currency(currency))
		if err != nil {
			return v, err
		}

		*f.into = tool.MoneyOf(m)
	}

	return v, nil
}
