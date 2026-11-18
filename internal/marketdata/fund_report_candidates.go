package marketdata

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/marketdata/fundreport"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

// fundReportCandidates lists the funds of src whose shared rows carry the exchange and code of in,
// by identifier (FR15).
func (m *Module) fundReportCandidates(
	ctx context.Context, src fundreport.Source, in Instrument,
) ([]FundReportCandidate, error) {
	rows, err := m.q.ListFundReportCandidates(ctx, postgres.ListFundReportCandidatesParams{
		Source: src.ID(), Exchange: in.Exchange, Code: string(in.Code),
	})
	if err != nil {
		return nil, fmt.Errorf("list the fund report candidates of %s: %w", in.Code, err)
	}

	out := make([]FundReportCandidate, len(rows))
	for i, r := range rows {
		out[i] = FundReportCandidate{
			Source: src.ID(), Identifier: r.Identifier, Name: r.Name, Segment: r.Segment,
		}
	}

	return out, nil
}

// isFundReportSource reports whether id names a fund report source; its symbol is a fund's
// identifier (FR15).
func (m *Module) isFundReportSource(id string) bool {
	for _, src := range m.feeds.FundReports {
		if src.ID() == id {
			return true
		}
	}

	return false
}
