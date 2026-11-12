package cvmfunds

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	firstYear = 2000
	// lastYear is the last year the CVM publishes as one file; later months are one file each.
	lastYear = 2020
)

var codePattern = regexp.MustCompile(`^[0-9A-Z]{14}$`)

var codeReplacer = strings.NewReplacer(".", "", "/", "", "-", "")

// Source reads the daily reports of investment funds published by the CVM (A222 MQ15).
type Source struct {
	client  *http.Client
	baseURL string
	seen    *feed.Conditional
}

// New returns a Source that reads the files under baseURL.
func New(c *http.Client, baseURL string) Source {
	return Source{client: c, baseURL: baseURL, seen: feed.NewConditional()}
}

func (Source) ID() string { return "cvm_funds" }

// Codes returns the funds identified by a CNPJ, sorted by code.
func (Source) Codes(ins []feed.Instrument) []money.Currency {
	var out []money.Currency
	for _, in := range ins {
		if in.Type == "fund" && in.Exchange == "" && in.QuoteCurrency == "BRL" &&
			codePattern.MatchString(string(in.Code)) {
			out = append(out, in.Code)
		}
	}

	slices.Sort(out)

	return slices.Compact(out)
}

// Fetch returns VL_QUOTA of each code for each day in [from, to]: the year files up to 2020, then
// one file per month (plan 2 D9). A failing file ends the fetch with a ScopeError and the quotes
// read before it.
func (s Source) Fetch(
	ctx context.Context,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	var (
		out     []feed.Quote
		pending = map[string]string{}
	)

	incremental := feed.Incremental(from, to)

	for _, f := range files(from, to) {
		url := s.baseURL + f.path
		key := url + "|" + joinCodes(codes)

		since := ""
		if f.monthly && incremental {
			since = s.seen.Since(key)
		}

		lastModified, err := feed.DownloadSince(
			ctx,
			s.client,
			url,
			since,
			func(file *os.File, size int64) error {
				quotes, err := readZip(file, size, codes, from, to)
				out = append(out, quotes...)

				return err
			},
		)
		if errors.Is(err, feed.ErrNoData) {
			continue
		}

		if err != nil {
			return out, &feed.ScopeError{
				Key:   f.key,
				Value: f.value,
				Err:   fmt.Errorf("fetch CVM funds: %w", err),
			}
		}

		if f.monthly {
			pending[key] = lastModified
		}
	}

	for key, lastModified := range pending {
		s.seen.Remember(key, lastModified)
	}

	return out, nil
}

type file struct {
	path, key, value string
	monthly          bool
}

// files lists the files that cover [from, to]: years first, then months, ascending.
func files(from, to time.Time) []file {
	var out []file

	for y := max(from.Year(), firstYear); y <= min(to.Year(), lastYear); y++ {
		out = append(out, file{
			path:  fmt.Sprintf("/HIST/inf_diario_fi_%d.zip", y),
			key:   "year",
			value: strconv.Itoa(y),
		})
	}

	m := time.Date(lastYear+1, 1, 1, 0, 0, 0, 0, time.UTC)
	if from.Year() > lastYear {
		m = time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
	}

	for ; !m.After(to); m = m.AddDate(0, 1, 0) {
		out = append(out, file{
			path:    "/inf_diario_fi_" + m.Format("200601") + ".zip",
			key:     "month",
			value:   m.Format("2006-01"),
			monthly: true,
		})
	}

	return out
}

func readZip(
	f *os.File,
	size int64,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	zr, err := zip.NewReader(f, size)
	if err != nil {
		return nil, fmt.Errorf("open CVM archive: %w", err)
	}

	var out []feed.Quote

	for _, entry := range zr.File {
		rc, err := entry.Open()
		if err != nil {
			return out, fmt.Errorf("open CVM entry %s: %w", entry.Name, err)
		}

		quotes, err := readQuotes(rc, codes, from, to)
		_ = rc.Close()

		out = append(out, quotes...)

		if err != nil {
			return out, fmt.Errorf("read CVM entry %s: %w", entry.Name, err)
		}
	}

	return out, nil
}

func readQuotes(r io.Reader, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	cr := csv.NewReader(r)
	cr.Comma = ';'
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true

	cols, err := readColumns(cr)
	if err != nil {
		return nil, err
	}

	var out []feed.Quote

	for n := 2; ; n++ {
		row, err := cr.Read()
		if errors.Is(err, io.EOF) {
			return out, nil
		}

		if err != nil {
			return out, fmt.Errorf("read line %d: %w", n, err)
		}

		q, ok, err := readRow(row, n, cols, codes, from, to)
		if err != nil {
			return out, err
		}

		if ok {
			out = append(out, q)
		}
	}
}

// readRow returns the quote of row; ok is false for a row without a quote to keep.
func readRow(
	row []string,
	n int,
	cols columns,
	codes []money.Currency,
	from, to time.Time,
) (feed.Quote, bool, error) {
	iCode, iSub, iDate, iValue := cols.code, cols.sub, cols.date, cols.value

	if len(row) <= max(iCode, iSub, iDate, iValue) {
		return feed.Quote{}, false, fmt.Errorf("read line %d: %d fields", n, len(row))
	}

	if iSub >= 0 && row[iSub] != "" {
		return feed.Quote{}, false, nil
	}

	code := money.Currency(codeReplacer.Replace(row[iCode]))
	if !slices.Contains(codes, code) {
		return feed.Quote{}, false, nil
	}

	date, err := time.Parse(time.DateOnly, row[iDate])
	if err != nil {
		return feed.Quote{}, false, fmt.Errorf("read line %d: %w", n, err)
	}

	if date.Before(from) || date.After(to) || strings.Trim(row[iValue], "0.") == "" {
		return feed.Quote{}, false, nil
	}

	value, err := money.ParseRate(row[iValue])
	if err != nil {
		return feed.Quote{}, false, fmt.Errorf("read line %d: %w", n, err)
	}

	return feed.Quote{Instrument: code, Quote: "BRL", Date: date, Value: value}, true, nil
}

// columns holds the index of each column the parser reads; sub is -1 when the file has none.
type columns struct {
	code, sub, date, value int
}

func readColumns(cr *csv.Reader) (columns, error) {
	header, err := cr.Read()
	if err != nil {
		return columns{}, fmt.Errorf("read header: %w", err)
	}

	col := func(name string) int { return slices.Index(header, name) }

	iCode := col("CNPJ_FUNDO_CLASSE")
	if iCode < 0 {
		iCode = col("CNPJ_FUNDO")
	}

	iSub, iDate, iValue := col("ID_SUBCLASSE"), col("DT_COMPTC"), col("VL_QUOTA")
	if slices.Contains([]int{iCode, iDate, iValue}, -1) {
		return columns{}, fmt.Errorf("read header: columns missing in %q", header)
	}

	return columns{code: iCode, sub: iSub, date: iDate, value: iValue}, nil
}

func joinCodes(codes []money.Currency) string {
	parts := make([]string, len(codes))
	for i, c := range codes {
		parts[i] = string(c)
	}

	return strings.Join(parts, ",")
}
