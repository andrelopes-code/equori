package tesourodireto

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var codePattern = regexp.MustCompile(`^(LFT|LTN|NTNF|NTNB|NTNBP|NTNC|EDUCA|RENDA)\.[0-9]{8}$`)

// prefixes maps the Tipo Titulo of the file to the code prefix (A222 MQ16). The values are ASCII,
// so a row with another byte cannot match and is skipped (plan 2 D6).
var prefixes = map[string]string{
	"Tesouro Selic":                          "LFT",
	"Tesouro Prefixado":                      "LTN",
	"Tesouro Prefixado com Juros Semestrais": "NTNF",
	"Tesouro IPCA+":                          "NTNBP",
	"Tesouro IPCA+ com Juros Semestrais":     "NTNB",
	"Tesouro IGPM+ com Juros Semestrais":     "NTNC",
	"Tesouro Educa+":                         "EDUCA",
	"Tesouro Renda+ Aposentadoria Extra":     "RENDA",
}

// Source reads the Tesouro Direto prices published by Tesouro Transparente.
type Source struct {
	client *http.Client
	url    string
	seen   *feed.Conditional
}

// New returns a Source that reads the CSV file at url.
func New(c *http.Client, url string) Source {
	return Source{client: c, url: url, seen: feed.NewConditional()}
}

func (Source) ID() string { return "tesouro_direto" }

// Codes returns the fixed income instruments the file can quote, sorted by code.
func (Source) Codes(ins []feed.Instrument) []money.Currency {
	var out []money.Currency
	for _, in := range ins {
		if in.Type == "fixed_income" && in.Exchange == "" && in.QuoteCurrency == "BRL" &&
			codePattern.MatchString(string(in.Code)) {
			out = append(out, in.Code)
		}
	}

	slices.Sort(out)

	return slices.Compact(out)
}

// Fetch returns PU Venda Manha of each code for each Data Base in [from, to]. A row with a zero
// price or a title type outside the map is skipped.
func (s Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	key := s.url + "|" + joinCodes(codes)

	since := ""
	if feed.Incremental(from, to) {
		since = s.seen.Since(key)
	}

	var out []feed.Quote

	lastModified, err := feed.DownloadSince(ctx, s.client, s.url, since, func(f *os.File, _ int64) error {
		var err error

		out, err = readQuotes(f, codes, from, to)

		return err
	})
	if errors.Is(err, feed.ErrNoData) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("fetch Tesouro prices: %w", err)
	}

	s.seen.Remember(key, lastModified)

	return out, nil
}

func readQuotes(r io.Reader, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	cr := csv.NewReader(r)
	cr.Comma = ';'
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true

	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("read Tesouro header: %w", err)
	}

	col := func(name string) int { return slices.Index(header, name) }
	iType, iMaturity, iBase, iPrice := col("Tipo Titulo"), col("Data Vencimento"), col("Data Base"), col("PU Venda Manha")

	if slices.Contains([]int{iType, iMaturity, iBase, iPrice}, -1) {
		return nil, fmt.Errorf("read Tesouro header: columns missing in %q", header)
	}

	var out []feed.Quote

	for n := 2; ; n++ {
		row, err := cr.Read()
		if errors.Is(err, io.EOF) {
			return out, nil
		}

		if err != nil {
			return nil, fmt.Errorf("read Tesouro line %d: %w", n, err)
		}

		prefix, ok := prefixes[row[iType]]
		if !ok {
			continue
		}

		maturity, err := time.Parse("02/01/2006", row[iMaturity])
		if err != nil {
			return nil, fmt.Errorf("read Tesouro line %d: %w", n, err)
		}

		code := money.Currency(prefix + "." + maturity.Format("20060102"))
		if !slices.Contains(codes, code) {
			continue
		}

		date, err := time.Parse("02/01/2006", row[iBase])
		if err != nil {
			return nil, fmt.Errorf("read Tesouro line %d: %w", n, err)
		}

		if date.Before(from) || date.After(to) {
			continue
		}

		if row[iPrice] == "0,00" {
			continue
		}

		value, err := money.ParseRate(strings.Replace(row[iPrice], ",", ".", 1))
		if err != nil {
			return nil, fmt.Errorf("read Tesouro line %d: %w", n, err)
		}

		out = append(out, feed.Quote{Instrument: code, Quote: "BRL", Date: date, Value: value})
	}
}

func joinCodes(codes []money.Currency) string {
	parts := make([]string, len(codes))
	for i, c := range codes {
		parts[i] = string(c)
	}

	return strings.Join(parts, ",")
}
