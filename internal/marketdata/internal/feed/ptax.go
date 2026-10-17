package feed

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// PTAX reads closing exchange rates from the Banco Central do Brasil Olinda service.
type PTAX struct {
	client  *http.Client
	baseURL string
}

func NewPTAX(c *http.Client, baseURL string) PTAX {
	return PTAX{client: c, baseURL: strings.TrimSuffix(baseURL, "/")}
}

type ptaxAnswer struct {
	Value []struct {
		CotacaoVenda    json.Number `json:"cotacaoVenda"`
		DataHoraCotacao string      `json:"dataHoraCotacao"`
		TipoBoletim     string      `json:"tipoBoletim"`
	} `json:"value"`
}

// Fetch returns the closing bulletin (sell rate, in BRL) of code for each day of
// [from, to] the BCB published; an empty answer returns no quote.
func (p PTAX) Fetch(ctx context.Context, code money.Currency, from, to time.Time) ([]Quote, error) {
	url := fmt.Sprintf("%s/ExchangeRatePeriod(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='%s'&@dataInicial='%s'&@dataFinalCotacao='%s'&$format=json",
		p.baseURL, code, from.Format("01-02-2006"), to.Format("01-02-2006"))
	body, err := get(ctx, p.client, url)
	if err != nil {
		return nil, fmt.Errorf("fetch PTAX %s: %w", code, err)
	}
	var a ptaxAnswer
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	if err := dec.Decode(&a); err != nil {
		return nil, fmt.Errorf("read PTAX %s: %w", code, err)
	}
	var out []Quote
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
		out = append(out, Quote{Instrument: code, Quote: "BRL", Date: date, Value: rate})
	}
	return out, nil
}
