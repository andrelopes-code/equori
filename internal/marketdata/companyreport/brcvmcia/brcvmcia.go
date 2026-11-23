// Package brcvmcia reads the statements of listed companies published by the CVM (CR3).
package brcvmcia

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

const (
	datasetURL = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp"
	currency   = "BRL"
	dfpYears   = 5
)

var identifierReplacer = strings.NewReplacer(".", "", "/", "", "-", "")

// Source reads the yearly files of the CVM under baseURL.
type Source struct {
	client  *http.Client
	baseURL string
	seen    *feed.Conditional
}

// archive is one statement file of the window: kind "dfp" or "itr" and its year.
type archive struct {
	kind string
	year int
}

// outcome tells what a request of a file gave.
type outcome int

const (
	absent outcome = iota
	unchanged
	loaded
)

func New(hc *http.Client, baseURL string) Source {
	return Source{client: hc, baseURL: baseURL, seen: feed.NewConditional()}
}

func (Source) ID() string { return "br_cvm_cia" }

func (Source) URL() string { return datasetURL }

// Fetch returns the files of the window that changed since the last read and the listings of
// the FCA when it changed.
func (s Source) Fetch(ctx context.Context, today time.Time) (companyreport.Snapshot, error) {
	snap := companyreport.Snapshot{Currency: currency}

	for _, a := range window(today.Year()) {
		snap.Window = append(snap.Window, a.name())

		file, got, err := s.fetchStatements(ctx, a)
		if err != nil {
			return companyreport.Snapshot{}, err
		}

		if got {
			snap.Files = append(snap.Files, file)
		}
	}

	var err error

	snap.Listings, err = s.fetchListings(ctx, today.Year())
	if err != nil {
		return companyreport.Snapshot{}, err
	}

	for y := today.Year(); y >= today.Year()-dfpYears; y-- {
		snap.CountYears = append(snap.CountYears, y)

		file, got, err := s.fetchCounts(ctx, y)
		if err != nil {
			return companyreport.Snapshot{}, err
		}

		if got {
			snap.Counts = append(snap.Counts, file)
		}
	}

	return snap, nil
}

func window(year int) []archive {
	var out []archive

	// A fiscal year that ends before December is filed in the DFP of its own year (AC0).
	for y := year; y >= year-dfpYears; y-- {
		out = append(out, archive{"dfp", y})
	}

	return append(out, archive{"itr", year}, archive{"itr", year - 1})
}

func (a archive) name() string { return a.kind + "_" + strconv.Itoa(a.year) }

func (a archive) path() string {
	return "/" + strings.ToUpper(a.kind) + "/DADOS/" + a.kind + "_cia_aberta_" +
		strconv.Itoa(a.year) + ".zip"
}

// fetchStatements reports whether the file was read; an absent or unchanged file is not.
func (s Source) fetchStatements(
	ctx context.Context,
	a archive,
) (companyreport.File, bool, error) {
	var reports []companyreport.Report

	got, err := s.get(ctx, a.path(), func(f *os.File, size int64) error {
		var err error

		reports, err = readStatements(f, size, a)

		return err
	})

	return companyreport.File{Name: a.name(), Reports: reports}, got == loaded, err
}

// fetchListings reads the FCA of the year, or of the year before when the register lacks it. It
// returns nil when no file was read.
func (s Source) fetchListings(ctx context.Context, year int) ([]companyreport.Listing, error) {
	for _, y := range []int{year, year - 1} {
		var listings []companyreport.Listing

		got, err := s.get(
			ctx,
			"/FCA/DADOS/fca_cia_aberta_"+strconv.Itoa(y)+".zip",
			func(f *os.File, size int64) error {
				var err error

				listings, err = readListings(f, size, y)

				return err
			},
		)
		if err != nil {
			return nil, err
		}

		switch got {
		case loaded:
			return listings, nil
		case unchanged:
			return nil, nil
		case absent:
		}
	}

	return nil, nil
}

// fetchCounts reads the share counts of the FRE of year; an absent or unchanged file is not read.
func (s Source) fetchCounts(ctx context.Context, year int) (companyreport.CountFile, bool, error) {
	var counts []companyreport.ShareCount

	got, err := s.get(
		ctx,
		"/FRE/DADOS/fre_cia_aberta_"+strconv.Itoa(year)+".zip",
		func(f *os.File, size int64) error {
			var err error

			counts, err = readCounts(f, size, year)

			return err
		},
	)

	return companyreport.CountFile{Year: year, Counts: counts}, got == loaded, err
}

// get downloads path under the base address. An answer without data on a file read before is a
// 304; shortcut: a 404 of such a file is taken as unchanged, the next fetch of a new Source
// reads it again.
func (s Source) get(
	ctx context.Context,
	path string,
	load func(f *os.File, size int64) error,
) (outcome, error) {
	url := s.baseURL + path
	since := s.seen.Since(url)

	lastModified, err := feed.DownloadSince(ctx, s.client, url, since, load)
	if errors.Is(err, feed.ErrNoData) && since != "" {
		return unchanged, nil
	}

	if errors.Is(err, feed.ErrNoData) {
		return absent, nil
	}

	if err != nil {
		return absent, fmt.Errorf("fetch CVM company file %s: %w", path, err)
	}

	s.seen.Remember(url, lastModified)

	return loaded, nil
}

// record is a row of a member; get reads a cell by its column name.
type record struct {
	cols  map[string]int
	cells []string
}

// get returns the cell converted from Latin-1 and trimmed; each byte is the rune of its value.
func (r record) get(name string) string {
	i := r.cols[name]
	if i >= len(r.cells) {
		return ""
	}

	runes := make([]rune, len(r.cells[i]))
	for j := range len(r.cells[i]) {
		runes[j] = rune(r.cells[i][j])
	}

	return strings.TrimSpace(string(runes))
}

// readMember calls each for every row of the member; it fails when the member or a required
// column is absent.
func readMember(zr *zip.Reader, member string, required []string, each func(record)) error {
	i := slices.IndexFunc(zr.File, func(f *zip.File) bool { return f.Name == member })
	if i < 0 {
		return fmt.Errorf("read CVM archive: member %s missing", member)
	}

	rc, err := zr.File[i].Open()
	if err != nil {
		return fmt.Errorf("open CVM member %s: %w", member, err)
	}

	defer func() { _ = rc.Close() }()

	return readRecords(rc, member, required, each)
}

func readRecords(r io.Reader, member string, required []string, each func(record)) error {
	cr := csv.NewReader(r)
	cr.Comma = ';'
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true
	cr.ReuseRecord = true

	header, err := cr.Read()
	if err != nil {
		return fmt.Errorf("read CVM member %s header: %w", member, err)
	}

	cols := make(map[string]int, len(header))
	for i, name := range header {
		cols[strings.TrimSpace(name)] = i
	}

	for _, name := range required {
		if _, ok := cols[name]; !ok {
			return fmt.Errorf("read CVM member %s: column %s missing", member, name)
		}
	}

	for n := 2; ; n++ {
		cells, err := cr.Read()
		if errors.Is(err, io.EOF) {
			return nil
		}

		if err != nil {
			return fmt.Errorf("read CVM member %s line %d: %w", member, n, err)
		}

		each(record{cols: cols, cells: cells})
	}
}

// minorUnits returns the cell times the scale and 100, rounded half away from zero; nil when
// the cell is blank, not a number, out of range or the scale is neither MIL nor UNIDADE.
func minorUnits(cell, scale string) *int64 {
	factor := map[string]int64{"MIL": 100000, "UNIDADE": 100}[scale]

	value, ok := new(big.Rat).SetString(cell)
	if !ok || factor == 0 {
		return nil
	}

	scaled := new(big.Int).Mul(value.Num(), big.NewInt(factor))
	quo, rem := new(big.Int).QuoRem(scaled, value.Denom(), new(big.Int))

	if rem.Abs(rem).Lsh(rem, 1).Cmp(value.Denom()) >= 0 {
		quo.Add(quo, big.NewInt(int64(scaled.Sign())))
	}

	return pointerIf(quo.IsInt64(), quo.Int64())
}

func pointerIf[T any](ok bool, v T) *T {
	if !ok {
		return nil
	}

	return &v
}
