// Package brtesouro reads the Tesouro Direto rates published by Tesouro Transparente as the
// prefixed and IPCA+ curves (indexer comparison IC11).
package brtesouro

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/curve"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

const (
	prefixedID = "br_tesouro_prefixed"
	ipcaID     = "br_tesouro_ipca"
	decimals   = 12
	dateLayout = "02/01/2006"
)

// curveIDs maps the Tipo Titulo of the file to the curve it feeds; other titles are skipped.
var curveIDs = map[string]string{
	"Tesouro Prefixado": prefixedID,
	"Tesouro IPCA+":     ipcaID,
}

// Source reads the Tesouro Direto rates from the CSV file at url.
type Source struct {
	client *http.Client
	url    string
	seen   *feed.Conditional
}

func New(hc *http.Client, url string) Source {
	return Source{client: hc, url: url, seen: feed.NewConditional()}
}

func (Source) ID() string { return "br_tesouro" }

func (Source) Describe() []curve.Info {
	return []curve.Info{
		{ID: prefixedID, Kind: curve.KindNominal, Index: "", Currency: "BRL"},
		{ID: ipcaID, Kind: curve.KindReal, Index: "ipca", Currency: "BRL"},
	}
}

// Fetch returns the curves of the latest Data Base of the file, or nil when the file did not
// change since the last fetch of the process.
func (s Source) Fetch(ctx context.Context) ([]curve.Curve, error) {
	var out []curve.Curve

	lastModified, err := feed.DownloadSince(
		ctx,
		s.client,
		s.url,
		s.seen.Since(s.url),
		func(f *os.File, _ int64) error {
			var err error

			out, err = readFile(f)

			return err
		},
	)
	if errors.Is(err, feed.ErrNoData) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("fetch Tesouro curves: %w", err)
	}

	s.seen.Remember(s.url, lastModified)

	return out, nil
}

// row is a kept line of the file.
type row struct {
	curveID  string
	maturity time.Time
	base     time.Time
	rate     string
}

func readFile(r io.Reader) ([]curve.Curve, error) {
	cr := csv.NewReader(r)
	cr.Comma = ';'
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true

	cols, err := readColumns(cr)
	if err != nil {
		return nil, err
	}

	var (
		rows   []row
		latest time.Time
	)

	for n := 2; ; n++ {
		record, err := cr.Read()
		if errors.Is(err, io.EOF) {
			return buildCurves(rows, latest), nil
		}

		if err != nil {
			return nil, fmt.Errorf("read Tesouro line %d: %w", n, err)
		}

		if len(record) <= max(cols.kind, cols.maturity, cols.base, cols.rate) {
			return nil, fmt.Errorf("read Tesouro line %d: %d fields", n, len(record))
		}

		base, baseErr := time.Parse(dateLayout, record[cols.base])
		if baseErr == nil && base.After(latest) {
			latest = base
		}

		kept, ok, err := readRow(record, n, cols)
		if err != nil {
			return nil, err
		}

		if ok {
			rows = append(rows, kept)
		}
	}
}

// columns holds the index of each column the parser reads.
type columns struct {
	kind, maturity, base, rate int
}

func readColumns(cr *csv.Reader) (columns, error) {
	header, err := cr.Read()
	if err != nil {
		return columns{}, fmt.Errorf("read Tesouro header: %w", err)
	}

	cols := columns{
		kind:     slices.Index(header, "Tipo Titulo"),
		maturity: slices.Index(header, "Data Vencimento"),
		base:     slices.Index(header, "Data Base"),
		rate:     slices.Index(header, "Taxa Compra Manha"),
	}

	if slices.Contains([]int{cols.kind, cols.maturity, cols.base, cols.rate}, -1) {
		return columns{}, fmt.Errorf("read Tesouro header: columns missing in %q", header)
	}

	return cols, nil
}

// readRow returns the row of a title the source serves; ok is false for a title outside the
// map and for a blank or zero rate, the rate of a title closed for purchase.
func readRow(record []string, n int, cols columns) (row, bool, error) {
	id, ok := curveIDs[record[cols.kind]]
	if !ok {
		return row{}, false, nil
	}

	cell := strings.TrimSpace(record[cols.rate])
	if cell == "" || cell == "0,00" {
		return row{}, false, nil
	}

	maturity, err := time.Parse(dateLayout, record[cols.maturity])
	if err != nil {
		return row{}, false, fmt.Errorf("read Tesouro line %d: %w", n, err)
	}

	base, err := time.Parse(dateLayout, record[cols.base])
	if err != nil {
		return row{}, false, fmt.Errorf("read Tesouro line %d: %w", n, err)
	}

	rate, err := parseRate(cell)
	if err != nil {
		return row{}, false, fmt.Errorf("read Tesouro line %d: %w", n, err)
	}

	return row{curveID: id, maturity: maturity, base: base, rate: rate}, true, nil
}

// parseRate turns a percentage with a decimal comma into an annual fraction.
func parseRate(cell string) (string, error) {
	value, ok := new(big.Rat).SetString(strings.Replace(cell, ",", ".", 1))
	if !ok {
		return "", fmt.Errorf("rate %q is not a number", cell)
	}

	return value.Quo(value, big.NewRat(100, 1)).FloatString(decimals), nil
}

// buildCurves keeps the rows of the latest Data Base of the file, one curve per title in the
// order of Describe, points sorted by maturity.
func buildCurves(rows []row, latest time.Time) []curve.Curve {
	var out []curve.Curve

	for _, id := range []string{prefixedID, ipcaID} {
		var points []curve.Point

		for _, r := range rows {
			if r.curveID == id && r.base.Equal(latest) {
				points = append(points, curve.Point{Maturity: r.maturity, Rate: r.rate})
			}
		}

		if len(points) == 0 {
			continue
		}

		slices.SortFunc(
			points,
			func(a, b curve.Point) int { return a.Maturity.Compare(b.Maturity) },
		)
		out = append(out, curve.Curve{ID: id, Base: latest, Points: points})
	}

	return out
}
