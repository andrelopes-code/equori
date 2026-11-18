package marketdata

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/fundreport"
	"github.com/andrelopes-code/equori/internal/marketdata/fundreport/brcvmfii"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

type FundReport = domain.FundReport

type fundReportEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of the month after a period by which the
	// next file is due (ADR 025 F9).
	lag   int
	build func(hc *http.Client, url string) fundreport.Source
}

func fundReportEntries() []fundReportEntry {
	return []fundReportEntry{
		{
			"br_cvm_fii",
			"https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS",
			20,
			func(hc *http.Client, url string) fundreport.Source { return brcvmfii.New(hc, url) },
		},
	}
}

// FundReportSourceIDs lists the fund report sources; an admin enables them on the settings screen.
func FundReportSourceIDs() []string {
	entries := fundReportEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewFundReportSources builds every fund report source; urls overrides a source's base URL.
func NewFundReportSources(urls map[string]string, hc *http.Client) []fundreport.Source {
	entries := fundReportEntries()

	out := make([]fundreport.Source, len(entries))
	for i, e := range entries {
		url := urls[e.id]
		if url == "" {
			url = e.defaultURL
		}

		out[i] = e.build(hc, url)
	}

	return out
}

// FundReports returns, for the instrument of code, one report set per enabled source that stored
// rows for its exchange and code, in the order of the registry; periods newest first. An unknown
// instrument gives an empty list.
func (m *Module) FundReports(ctx context.Context, code string) ([]FundReport, error) {
	in, err := m.Instrument(ctx, code)
	if err == nil && !in.VisibleTo(auth.MustBooksID(ctx)) {
		err = domain.ErrUnknownInstrument
	}

	if errors.Is(err, domain.ErrUnknownInstrument) {
		return []FundReport{}, nil
	}

	if err != nil {
		return nil, err
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := m.q.ListFundReports(
		ctx,
		postgres.ListFundReportsParams{Exchange: in.Exchange, Code: string(in.Code)},
	)
	if err != nil {
		return nil, fmt.Errorf("list the fund reports of %s: %w", in.Code, err)
	}

	out := []FundReport{}

	for _, src := range m.feeds.FundReports {
		if !on[src.ID()] {
			continue
		}

		r, err := storedFundReport(src, in, rows)
		if err != nil {
			return nil, err
		}

		if len(r.Periods) > 0 {
			out = append(out, r)
		}
	}

	return out, nil
}

// tickFundReports runs the enabled fund report sources.
func (m *Module) tickFundReports(ctx context.Context, on map[string]bool) {
	for _, src := range m.feeds.FundReports {
		if on[src.ID()] {
			err := m.tickFundReport(ctx, src)
			if err != nil {
				m.logFeed(ctx, err, "source", src.ID())
			}

			m.ran(src.ID(), err)
		}
	}
}

// tickFundReport replaces the stored rows of each fetched period and keeps the latest periods.
func (m *Module) tickFundReport(ctx context.Context, src fundreport.Source) error {
	have, err := m.q.ListFundReportPeriods(ctx, src.ID())
	if err != nil {
		return fmt.Errorf("list the periods of %s: %w", src.ID(), err)
	}

	snap, err := src.Fetch(ctx, m.feeds.Clock.Today(ctx), have)
	if err != nil {
		return err
	}

	if len(snap.Reports) == 0 {
		return nil
	}

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	if err := storeFundReports(ctx, q, src.ID(), snap); err != nil {
		return err
	}

	err = q.DeleteFundReportPeriodsBeyond(ctx, postgres.DeleteFundReportPeriodsBeyondParams{
		Source: src.ID(), Kept: fundreport.KeptPeriods,
	})
	if err != nil {
		return fmt.Errorf("delete the old periods of %s: %w", src.ID(), err)
	}

	return tx.Commit(ctx)
}

// fundReportFeeds appends the fund report sources to out.
func (m *Module) fundReportFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	for _, src := range m.feeds.FundReports {
		latest, err := m.q.LatestFundReportPeriod(ctx, src.ID())
		if err != nil {
			return nil, fmt.Errorf("read the latest period of %s: %w", src.ID(), err)
		}

		var last *time.Time
		if latest.Found {
			last = &latest.Latest
		}

		out = append(
			out,
			m.feed(
				ctx,
				src.ID(),
				domain.FeedFundReport,
				index.PeriodMonth,
				last,
				fs.on,
				fs.suggested,
				fs.lags,
			),
		)
	}

	return out, nil
}

// storeFundReports replaces the rows of each period of snap; Reports are sorted by period.
func storeFundReports(
	ctx context.Context, q *postgres.Queries, source string, snap fundreport.Snapshot,
) error {
	var done time.Time

	for _, r := range snap.Reports {
		if !r.Period.Equal(done) {
			err := q.DeleteFundReportPeriod(
				ctx,
				postgres.DeleteFundReportPeriodParams{Source: source, Period: r.Period},
			)
			if err != nil {
				return fmt.Errorf(
					"delete the period %s of %s: %w",
					r.Period.Format(time.DateOnly),
					source,
					err,
				)
			}

			done = r.Period
		}

		params, err := fundReportParams(source, snap.Currency, r)
		if err != nil {
			return err
		}

		if err := q.InsertFundReport(ctx, params); err != nil {
			return fmt.Errorf("store the report of %s: %w", r.Code, err)
		}
	}

	return nil
}

func fundReportParams(
	source, currency string, r fundreport.Report,
) (postgres.InsertFundReportParams, error) {
	p := postgres.InsertFundReportParams{
		Source: source, Exchange: r.Exchange, Code: r.Code, Period: r.Period,
		Currency: currency, Identifier: r.Identifier, Name: r.Name, Segment: r.Segment,
		Delivered: r.Delivered, NetAssets: r.NetAssets, Holders: r.Holders,
	}

	for _, f := range []struct {
		from *string
		to   *pgtype.Numeric
	}{
		{r.Units, &p.Units}, {r.UnitBookValue, &p.UnitBookValue}, {r.AdminFee, &p.AdminFee},
		{r.MonthYield, &p.MonthYield}, {r.MonthAmortization, &p.MonthAmortization},
	} {
		if f.from == nil {
			continue
		}

		if err := f.to.Scan(*f.from); err != nil {
			return p, fmt.Errorf("figure of %s: %w", r.Code, err)
		}
	}

	return p, nil
}

// storedFundReport builds the report set of src from the rows of one instrument; Periods is
// empty when src stored none.
func storedFundReport(
	src fundreport.Source, in Instrument, rows []postgres.ListFundReportsRow,
) (FundReport, error) {
	out := FundReport{
		Source: src.ID(), SourceURL: src.URL(), Exchange: in.Exchange, Code: string(in.Code),
		Periods: []domain.FundReportPeriod{},
	}

	for _, r := range rows {
		if r.Source != src.ID() {
			continue
		}

		p, err := fundReportPeriod(r)
		if err != nil {
			return FundReport{}, err
		}

		if len(out.Periods) == 0 {
			out.Currency, out.Identifier = r.Currency, r.Identifier
			out.Name, out.Segment = r.Name, r.Segment
		}

		out.Periods = append(out.Periods, p)
	}

	return out, nil
}

func fundReportPeriod(r postgres.ListFundReportsRow) (domain.FundReportPeriod, error) {
	p := domain.FundReportPeriod{
		Period: r.Period, Delivered: r.Delivered, NetAssets: r.NetAssets, Holders: r.Holders,
	}

	for _, f := range []struct {
		from  pgtype.Numeric
		to    **string
		scale int
	}{
		{r.Units, &p.Units, 8}, {r.UnitBookValue, &p.UnitBookValue, 12},
		{r.AdminFee, &p.AdminFee, 12}, {r.MonthYield, &p.MonthYield, 12},
		{r.MonthAmortization, &p.MonthAmortization, 12},
	} {
		s, err := numericText(f.from)
		if err != nil {
			return domain.FundReportPeriod{}, fmt.Errorf(
				"figure of %s: %w", r.Period.Format(time.DateOnly), err,
			)
		}

		// The binary form of a zero numeric carries no scale; the column fixes it.
		if s != nil && *s == "0" {
			zero := "0." + strings.Repeat("0", f.scale)
			s = &zero
		}

		*f.to = s
	}

	return p, nil
}
