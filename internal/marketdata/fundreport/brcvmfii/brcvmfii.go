// Package brcvmfii reads the monthly reports of real estate funds published by the CVM (FR3).
package brcvmfii

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/fundreport"
)

const (
	datasetURL = "https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal"
	exchange   = "BVMF"
	currency   = "BRL"
)

// Source reads the yearly files of the CVM under baseURL.
type Source struct {
	client  *http.Client
	baseURL string
	seen    *feed.Conditional
}

func New(hc *http.Client, baseURL string) Source {
	return Source{client: hc, baseURL: baseURL, seen: feed.NewConditional()}
}

func (Source) ID() string { return "br_cvm_fii" }

func (Source) URL() string { return datasetURL }

// Fetch returns the reports of the file of today's year and of the year twelve months before.
func (s Source) Fetch(
	ctx context.Context,
	today time.Time,
	have []time.Time,
) (fundreport.Snapshot, error) {
	snap := fundreport.Snapshot{Currency: currency}

	for _, year := range []int{today.AddDate(0, -12, 0).Year(), today.Year()} {
		if yearComplete(year, have) {
			continue
		}

		reports, err := s.fetchYear(ctx, year)
		if err != nil {
			return fundreport.Snapshot{}, err
		}

		snap.Reports = append(snap.Reports, reports...)
	}

	slices.SortFunc(snap.Reports, compareReports)

	return snap, nil
}

// fetchYear returns nil when the file did not change or the register does not hold it.
func (s Source) fetchYear(ctx context.Context, year int) ([]fundreport.Report, error) {
	var reports []fundreport.Report

	url := s.baseURL + "/inf_mensal_fii_" + strconv.Itoa(year) + ".zip"

	lastModified, err := feed.DownloadSince(
		ctx,
		s.client,
		url,
		s.seen.Since(url),
		func(f *os.File, size int64) error {
			var err error

			reports, err = readArchive(f, size, year)

			return err
		},
	)
	if errors.Is(err, feed.ErrNoData) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("fetch CVM fund reports of %d: %w", year, err)
	}

	s.seen.Remember(url, lastModified)

	return reports, nil
}

func yearComplete(year int, have []time.Time) bool {
	for m := time.January; m <= time.December; m++ {
		if !slices.ContainsFunc(have, func(p time.Time) bool {
			return p.Year() == year && p.Month() == m
		}) {
			return false
		}
	}

	return true
}

func compareReports(a, b fundreport.Report) int {
	if c := a.Period.Compare(b.Period); c != 0 {
		return c
	}

	if c := strings.Compare(a.Code, b.Code); c != 0 {
		return c
	}

	return strings.Compare(a.Identifier, b.Identifier)
}

func readArchive(f *os.File, size int64, year int) ([]fundreport.Report, error) {
	zr, err := zip.NewReader(f, size)
	if err != nil {
		return nil, fmt.Errorf("open CVM archive: %w", err)
	}

	suffix := strconv.Itoa(year) + ".csv"

	general, err := readGeneral(zr, "inf_mensal_fii_geral_"+suffix)
	if err != nil {
		return nil, err
	}

	complement, err := readComplement(zr, "inf_mensal_fii_complemento_"+suffix)
	if err != nil {
		return nil, err
	}

	return join(general, complement), nil
}
