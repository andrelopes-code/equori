package bcbptax

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Source reads closing exchange rates from the Banco Central do Brasil Olinda service.
type Source struct {
	client  *http.Client
	baseURL string
}

func New(c *http.Client, baseURL string) Source {
	return Source{client: c, baseURL: strings.TrimSuffix(baseURL, "/")}
}

func (Source) ID() string { return "bcb_ptax" }

// Codes returns the currency instruments the BCB quotes; others are not requested.
func (s Source) Codes(ins []feed.Instrument) []money.Currency {
	var out []money.Currency
	for _, in := range ins {
		if in.Type == "currency" && in.Code != "BRL" && supports(in.Code) {
			out = append(out, in.Code)
		}
	}
	return out
}

func supports(code money.Currency) bool {
	switch code {
	case "ARS", "AUD", "CAD", "CHF", "CLP", "CNY", "COP", "EUR", "GBP", "JPY", "MXN", "PYG", "USD", "UYU":
		return true
	}
	return false
}

type ptaxAnswer struct {
	Value []struct {
		CotacaoVenda    json.Number `json:"cotacaoVenda"`
		DataHoraCotacao string      `json:"dataHoraCotacao"`
		TipoBoletim     string      `json:"tipoBoletim"`
	} `json:"value"`
}

// Fetch returns the closing bulletin (sell rate, in BRL) of each code for each day of
// [from, to] the BCB published. A code with no data is skipped; a code that fails is
// skipped and its failure, a feed.ScopeError, is joined into the returned error.
func (p Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	var out []feed.Quote
	var errs []error
	for _, code := range codes {
		quotes, err := p.fetchCode(ctx, code, from, to)
		out = append(out, quotes...)
		if err != nil && !errors.Is(err, feed.ErrNoData) {
			errs = append(errs, &feed.ScopeError{Key: "instrument", Value: string(code), Err: err})
		}
	}
	return out, errors.Join(errs...)
}

func (p Source) fetchCode(ctx context.Context, code money.Currency, from, to time.Time) ([]feed.Quote, error) {
	url := fmt.Sprintf("%s/ExchangeRatePeriod(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='%s'&@dataInicial='%s'&@dataFinalCotacao='%s'&$format=json",
		p.baseURL, code, from.Format("01-02-2006"), to.Format("01-02-2006"))
	body, err := feed.Get(ctx, p.client, url)
	if err != nil {
		return nil, fmt.Errorf("fetch PTAX %s: %w", code, err)
	}
	var a ptaxAnswer
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	if err := dec.Decode(&a); err != nil {
		return nil, fmt.Errorf("read PTAX %s: %w", code, err)
	}
	var out []feed.Quote
	for _, v := range a.Value {
		if v.TipoBoletim != "Fechamento" {
			continue
		}
		date, err := time.Parse(time.DateOnly, strings.SplitN(v.DataHoraCotacao, " ", 2)[0])
		if err != nil {
			return nil, fmt.Errorf("read PTAX %s date %q: %w", code, v.DataHoraCotacao, err)
		}
		rate, err := money.ParseRate(v.CotacaoVenda.String())
		if err != nil {
			return nil, fmt.Errorf("read PTAX %s rate: %w", code, err)
		}
		out = append(out, feed.Quote{Instrument: code, Quote: "BRL", Date: date, Value: rate})
	}
	return out, nil
}
