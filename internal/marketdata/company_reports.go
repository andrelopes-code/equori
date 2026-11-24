package marketdata

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
	"github.com/andrelopes-code/equori/internal/marketdata/companyreport/brcvmcia"
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

type CompanyReport = domain.CompanyReport

type companyReportEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of the quarter after a period by which the
	// next file is due (ADR 025 F9).
	lag   int
	build func(hc *http.Client, url string) companyreport.Source
}

func companyReportEntries() []companyReportEntry {
	return []companyReportEntry{
		{
			"br_cvm_cia",
			"https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC",
			90,
			func(hc *http.Client, url string) companyreport.Source { return brcvmcia.New(hc, url) },
		},
	}
}

// CompanyReportSourceIDs lists the company report sources; an admin enables them on the settings
// screen.
func CompanyReportSourceIDs() []string {
	entries := companyReportEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewCompanyReportSources builds every company report source; urls overrides a source's base URL.
func NewCompanyReportSources(urls map[string]string, hc *http.Client) []companyreport.Source {
	entries := companyReportEntries()

	out := make([]companyreport.Source, len(entries))
	for i, e := range entries {
		url := urls[e.id]
		if url == "" {
			url = e.defaultURL
		}

		out[i] = e.build(hc, url)
	}

	return out
}

// CompanyReports returns, for the instrument of code, one report set per enabled source that holds
// its company: the company its symbol for the source names, else the one the listing of its
// exchange and code names. An unknown instrument gives an empty list.
func (m *Module) CompanyReports(ctx context.Context, code string) ([]CompanyReport, error) {
	out := []CompanyReport{}

	in, err := m.Instrument(ctx, code)
	if err == nil && !in.VisibleTo(auth.MustBooksID(ctx)) {
		err = domain.ErrUnknownInstrument
	}

	if errors.Is(err, domain.ErrUnknownInstrument) {
		return out, nil
	}

	if err != nil {
		return nil, err
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	for _, src := range m.feeds.CompanyReports {
		if !on[src.ID()] {
			continue
		}

		r, err := m.storedCompanyReport(ctx, src, in)
		if err != nil {
			return nil, err
		}

		if len(r.Periods) > 0 {
			out = append(out, r)
		}
	}

	return out, nil
}

// tickCompanyReport replaces the stored rows of each fetched file and the listings, and deletes
// the rows of the files outside the window.
func (m *Module) tickCompanyReport(ctx context.Context, src companyreport.Source) error {
	snap, err := src.Fetch(ctx, m.feeds.Clock.Today(ctx))
	if err != nil {
		return err
	}

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	if err := storeCompanyReports(ctx, q, src.ID(), snap); err != nil {
		return err
	}

	err = q.DeleteCompanyReportsOutside(ctx, postgres.DeleteCompanyReportsOutsideParams{
		Source: src.ID(), Files: snap.Window,
	})
	if err != nil {
		return fmt.Errorf("delete the old files of %s: %w", src.ID(), err)
	}

	if snap.Listings != nil {
		if err := storeCompanyListings(ctx, q, src.ID(), snap.Listings); err != nil {
			return err
		}
	}

	if err := storeCompanyShareCounts(ctx, q, src.ID(), snap); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// companyReportFeeds appends the company report sources to out.
func (m *Module) companyReportFeeds(
	ctx context.Context, out []Feed, fs feedState,
) ([]Feed, error) {
	for _, src := range m.feeds.CompanyReports {
		latest, err := m.q.LatestCompanyReportPeriod(ctx, src.ID())
		if err != nil {
			return nil, fmt.Errorf("read the latest period of %s: %w", src.ID(), err)
		}

		var last *time.Time
		if latest.Found {
			last = &latest.Latest
		}

		f := m.feed(
			ctx,
			src.ID(),
			domain.FeedCompanyReport,
			periodQuarter,
			last,
			fs.on,
			fs.suggested,
			fs.lags,
		)
		// CR6: the symbol of a company report source names the company an instrument reads.
		f.SymbolOverride = true
		out = append(out, f)
	}

	return out, nil
}

// isCompanyReportSource reports whether id names a company report source; its symbol is a
// company's identifier.
func (m *Module) isCompanyReportSource(id string) bool {
	for _, src := range m.feeds.CompanyReports {
		if src.ID() == id {
			return true
		}
	}

	return false
}

// storeCompanyReports replaces the rows of each file of snap.
func storeCompanyReports(
	ctx context.Context, q *postgres.Queries, source string, snap companyreport.Snapshot,
) error {
	for _, f := range snap.Files {
		err := q.DeleteCompanyReportFile(
			ctx, postgres.DeleteCompanyReportFileParams{Source: source, File: f.Name},
		)
		if err != nil {
			return fmt.Errorf("delete the file %s of %s: %w", f.Name, source, err)
		}

		for _, r := range f.Reports {
			err := q.InsertCompanyReport(ctx, companyReportParams(source, snap.Currency, f.Name, r))
			if err != nil {
				return fmt.Errorf("store the report of %s in %s: %w", r.Identifier, f.Name, err)
			}
		}
	}

	return nil
}

func storeCompanyListings(
	ctx context.Context, q *postgres.Queries, source string, listings []companyreport.Listing,
) error {
	if err := q.DeleteCompanyListings(ctx, source); err != nil {
		return fmt.Errorf("delete the listings of %s: %w", source, err)
	}

	for _, l := range listings {
		err := q.InsertCompanyListing(ctx, postgres.InsertCompanyListingParams{
			Source: source, Exchange: l.Exchange, Code: l.Code, Identifier: l.Identifier,
			Name: l.Name, SharesPerUnit: smallint(l.SharesPerUnit), Financial: l.Financial,
		})
		if err != nil {
			return fmt.Errorf("store the listing %s of %s: %w", l.Code, source, err)
		}
	}

	return nil
}

func companyReportParams(
	source, currency, file string, r companyreport.Report,
) postgres.InsertCompanyReportParams {
	//nolint:gosec // G115: the adapter keeps Months in 1-12, the span of one fiscal year
	return postgres.InsertCompanyReportParams{
		Source: source, Identifier: r.Identifier, Period: r.Period, Months: int16(r.Months),
		File: file, Currency: currency, Name: r.Name, Consolidated: r.Consolidated,
		Plan: r.Plan, Delivered: r.Delivered, TotalAssets: r.TotalAssets,
		CurrentAssets: r.CurrentAssets, Cash: r.Cash, ShortInvestments: r.ShortInvestments,
		CurrentLiabilities: r.CurrentLiabilities, ShortDebt: r.ShortDebt, LongDebt: r.LongDebt,
		Equity: r.Equity, Revenue: r.Revenue, GrossProfit: r.GrossProfit, NetIncome: r.NetIncome,
		OperatingCashFlow: r.OperatingCashFlow, SharesIssued: r.SharesIssued,
		SharesTreasury: r.SharesTreasury, NetIncomeParent: r.NetIncomeParent,
		EquityMinority: r.EquityMinority, ClassesDiffer: r.ClassesDiffer,
		CapitalRaised: r.CapitalRaised,
	}
}

// storedCompanyReport builds the report set of src for one instrument: the company its symbol for
// src names, else the one the listing of its exchange and code names. Periods is empty when src
// holds none.
func (m *Module) storedCompanyReport(
	ctx context.Context, src companyreport.Source, in Instrument,
) (CompanyReport, error) {
	out := CompanyReport{
		Source: src.ID(), SourceURL: src.URL(), Periods: []domain.CompanyReportPeriod{},
	}

	identifier, err := m.companyOf(ctx, src.ID(), in, &out)
	if err != nil || identifier == "" {
		return out, err
	}

	rows, err := m.q.ListCompanyReports(ctx, postgres.ListCompanyReportsParams{
		Source: src.ID(), Identifier: identifier,
	})
	if err != nil {
		return CompanyReport{}, fmt.Errorf("list the company reports of %s: %w", in.Code, err)
	}

	for i, r := range rows {
		if i == 0 {
			out.Identifier, out.Name, out.Consolidated = r.Identifier, r.Name, r.Consolidated
			out.Plan, out.Currency = r.Plan, r.Currency
		}

		out.Periods = append(out.Periods, companyReportPeriod(r))
	}

	out.Financial, err = m.q.CompanyFinancial(ctx, postgres.CompanyFinancialParams{
		Source: src.ID(), Identifier: identifier,
	})
	if err != nil {
		return CompanyReport{}, fmt.Errorf("read the sector of %s: %w", in.Code, err)
	}

	out.ShareCounts, err = m.shareCounts(ctx, src.ID(), identifier)

	return out, err
}

func companyReportPeriod(r postgres.ListCompanyReportsRow) domain.CompanyReportPeriod {
	return domain.CompanyReportPeriod{
		Period: r.Period, Months: int(r.Months), Delivered: r.Delivered,
		TotalAssets: r.TotalAssets, CurrentAssets: r.CurrentAssets, Cash: r.Cash,
		ShortInvestments: r.ShortInvestments, CurrentLiabilities: r.CurrentLiabilities,
		ShortDebt: r.ShortDebt, LongDebt: r.LongDebt, Equity: r.Equity, Revenue: r.Revenue,
		GrossProfit: r.GrossProfit, NetIncome: r.NetIncome, OperatingCashFlow: r.OperatingCashFlow,
		SharesIssued: r.SharesIssued, SharesTreasury: r.SharesTreasury,
		NetIncomeParent: r.NetIncomeParent, EquityMinority: r.EquityMinority,
		ClassesDiffer: r.ClassesDiffer, CapitalRaised: r.CapitalRaised,
	}
}
