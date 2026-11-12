package tesourodireto

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
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
	list   *feed.ListCache
}

// New returns a Source that reads the CSV file at url.
func New(c *http.Client, url string) Source {
	return Source{
		client: c,
		url:    url,
		seen:   feed.NewConditional(),
		list:   feed.NewListCache(time.Now),
	}
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
func (s Source) Fetch(
	ctx context.Context,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	key := s.url + "|" + joinCodes(codes)

	since := ""
	if feed.Incremental(from, to) {
		since = s.seen.Since(key)
	}

	var out []feed.Quote

	lastModified, err := feed.DownloadSince(
		ctx,
		s.client,
		s.url,
		since,
		func(f *os.File, _ int64) error {
			var err error

			var list []feed.Listing

			out, list, err = readFile(f, codes, from, to)
			if err == nil {
				s.list.Set(list)
			}

			return err
		},
	)
	if errors.Is(err, feed.ErrNoData) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("fetch Tesouro prices: %w", err)
	}

	s.seen.Remember(key, lastModified)

	return out, nil
}

// Search returns the titles of the latest Data Base of the file whose code or name contains query.
// Without a fresh list it downloads the file.
func (s Source) Search(ctx context.Context, query string, limit int) ([]feed.Listing, error) {
	list, ok := s.list.Fresh()
	if !ok {
		_, err := feed.DownloadSince(ctx, s.client, s.url, "", func(f *os.File, _ int64) error {
			var err error

			_, list, err = readFile(f, nil, time.Time{}, time.Time{})
			if err == nil {
				s.list.Set(list)
			}

			return err
		})
		if err != nil && !errors.Is(err, feed.ErrNoData) {
			return nil, fmt.Errorf("search Tesouro titles: %w", err)
		}
	}

	return feed.MatchListings(list, query, limit), nil
}

// readFile returns the quotes of codes in [from, to] and the titles of the latest Data Base.
func readFile(
	r io.Reader,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, []feed.Listing, error) {
	cr := csv.NewReader(r)
	cr.Comma = ';'
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true

	cols, err := readColumns(cr)
	if err != nil {
		return nil, nil, err
	}

	var (
		out    []feed.Quote
		titles latestTitles
	)

	for n := 2; ; n++ {
		row, err := cr.Read()
		if errors.Is(err, io.EOF) {
			return out, titles.sorted(), nil
		}

		if err != nil {
			return nil, nil, fmt.Errorf("read Tesouro line %d: %w", n, err)
		}

		q, ok, err := readRow(row, n, cols, codes, from, to, &titles)
		if err != nil {
			return nil, nil, err
		}

		if ok {
			out = append(out, q)
		}
	}
}

// columns holds the index of each column the parser reads.
type columns struct {
	kind, maturity, base, price int
}

func readColumns(cr *csv.Reader) (columns, error) {
	header, err := cr.Read()
	if err != nil {
		return columns{}, fmt.Errorf("read Tesouro header: %w", err)
	}

	col := func(name string) int { return slices.Index(header, name) }
	iType, iMaturity, iBase, iPrice := col(
		"Tipo Titulo",
	), col(
		"Data Vencimento",
	), col(
		"Data Base",
	), col(
		"PU Venda Manha",
	)

	if slices.Contains([]int{iType, iMaturity, iBase, iPrice}, -1) {
		return columns{}, fmt.Errorf("read Tesouro header: columns missing in %q", header)
	}

	return columns{kind: iType, maturity: iMaturity, base: iBase, price: iPrice}, nil
}

// readRow records the title of row in titles and returns its quote; ok is false for a row
// without a quote to keep.
func readRow(
	row []string,
	n int,
	cols columns,
	codes []money.Currency,
	from, to time.Time,
	titles *latestTitles,
) (feed.Quote, bool, error) {
	prefix, ok := prefixes[row[cols.kind]]
	if !ok {
		return feed.Quote{}, false, nil
	}

	maturity, err := time.Parse("02/01/2006", row[cols.maturity])
	if err != nil {
		return feed.Quote{}, false, fmt.Errorf("read Tesouro line %d: %w", n, err)
	}

	code := money.Currency(prefix + "." + maturity.Format("20060102"))

	base, baseErr := time.Parse("02/01/2006", row[cols.base])
	if baseErr == nil {
		titles.add(base, feed.Listing{
			Code:          code,
			Name:          row[cols.kind] + " " + maturity.Format("2006"),
			Type:          "fixed_income",
			QuoteCurrency: "BRL",
		})
	}

	if !slices.Contains(codes, code) {
		return feed.Quote{}, false, nil
	}

	if baseErr != nil {
		return feed.Quote{}, false, fmt.Errorf("read Tesouro line %d: %w", n, baseErr)
	}

	if base.Before(from) || base.After(to) {
		return feed.Quote{}, false, nil
	}

	if row[cols.price] == "0,00" {
		return feed.Quote{}, false, nil
	}

	value, err := money.ParseRate(strings.Replace(row[cols.price], ",", ".", 1))
	if err != nil {
		return feed.Quote{}, false, fmt.Errorf("read Tesouro line %d: %w", n, err)
	}

	return feed.Quote{Instrument: code, Quote: "BRL", Date: base, Value: value}, true, nil
}

// latestTitles collects the titles of the latest Data Base seen.
type latestTitles struct {
	base time.Time
	list map[money.Currency]feed.Listing
}

func (t *latestTitles) add(base time.Time, l feed.Listing) {
	if base.Before(t.base) {
		return
	}

	if base.After(t.base) {
		t.base, t.list = base, map[money.Currency]feed.Listing{}
	}

	t.list[l.Code] = l
}

func (t *latestTitles) sorted() []feed.Listing {
	out := slices.Collect(maps.Values(t.list))
	slices.SortFunc(
		out,
		func(a, b feed.Listing) int { return strings.Compare(string(a.Code), string(b.Code)) },
	)

	return out
}

func joinCodes(codes []money.Currency) string {
	parts := make([]string, len(codes))
	for i, c := range codes {
		parts[i] = string(c)
	}

	return strings.Join(parts, ",")
}
