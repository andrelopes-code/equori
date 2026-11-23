package marketdata

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

// storeCompanyShareCounts replaces the counts of each year of snap and deletes those of a year
// outside its window.
func storeCompanyShareCounts(
	ctx context.Context,
	q *postgres.Queries,
	source string,
	snap companyreport.Snapshot,
) error {
	read := make([]int16, len(snap.Counts))
	for i, f := range snap.Counts {
		read[i] = int16(f.Year) //nolint:gosec // G115: a calendar year
	}

	window := make([]int16, len(snap.CountYears))
	for i, y := range snap.CountYears {
		window[i] = int16(y) //nolint:gosec // G115: a calendar year
	}

	err := q.DeleteCompanyShareCounts(ctx, postgres.DeleteCompanyShareCountsParams{
		Source: source, ReadYears: read, WindowYears: window,
	})
	if err != nil {
		return fmt.Errorf("delete the share counts of %s: %w", source, err)
	}

	for i, f := range snap.Counts {
		for _, c := range f.Counts {
			err := q.InsertCompanyShareCount(ctx, postgres.InsertCompanyShareCountParams{
				Source: source, Identifier: c.Identifier, Year: read[i], Shares: c.Shares,
			})
			if err != nil {
				return fmt.Errorf("store the share count of %s: %w", c.Identifier, err)
			}
		}
	}

	return nil
}

// companyOf returns the company an instrument reads, "" without one: the one its symbol for source
// names, else the one the listing of its exchange and code names. The shares of the listing are set
// on out when the listing is of that company.
func (m *Module) companyOf(
	ctx context.Context,
	source string,
	in Instrument,
	out *CompanyReport,
) (string, error) {
	listing, err := m.q.CompanyListing(ctx, postgres.CompanyListingParams{
		Source: source, Exchange: in.Exchange, Code: string(in.Code),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("find the company of %s: %w", in.Code, err)
	}

	identifier, linked := in.Symbols[source]
	if !linked {
		identifier = listing.Identifier
	}

	if listing.Identifier == identifier && listing.SharesPerUnit != nil {
		shares := int(*listing.SharesPerUnit)
		out.SharesPerUnit = &shares
	}

	return identifier, nil
}

func (m *Module) shareCounts(
	ctx context.Context,
	source, identifier string,
) (map[int]int64, error) {
	rows, err := m.q.ListCompanyShareCounts(ctx, postgres.ListCompanyShareCountsParams{
		Source: source, Identifier: identifier,
	})
	if err != nil {
		return nil, fmt.Errorf("list the share counts of %s: %w", identifier, err)
	}

	out := make(map[int]int64, len(rows))
	for _, r := range rows {
		out[int(r.Year)] = r.Shares
	}

	return out, nil
}

func smallint(n *int) *int16 {
	if n == nil {
		return nil
	}

	v := int16(*n) //nolint:gosec // G115: the source keeps it in 1-100

	return &v
}
