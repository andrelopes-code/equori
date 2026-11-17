package marketdata

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/curve"
	"github.com/andrelopes-code/equori/internal/marketdata/curve/brtesouro"
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

type Curve = domain.Curve

type curveEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of the day after a base date by which the
	// next file is due (ADR 025 F9).
	lag   int
	build func(hc *http.Client, url string) curve.Source
}

func curveEntries() []curveEntry {
	return []curveEntry{
		{
			"br_tesouro",
			"https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv",
			5,
			func(hc *http.Client, url string) curve.Source { return brtesouro.New(hc, url) },
		},
	}
}

// CurveSourceIDs lists the curve sources; an admin enables them on the settings screen.
func CurveSourceIDs() []string {
	entries := curveEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewCurveSources builds every curve source; urls overrides a source's file URL.
func NewCurveSources(urls map[string]string, hc *http.Client) []curve.Source {
	entries := curveEntries()

	out := make([]curve.Source, len(entries))
	for i, e := range entries {
		url := urls[e.id]
		if url == "" {
			url = e.defaultURL
		}

		out[i] = e.build(hc, url)
	}

	return out
}

// Curves returns the stored curves of the enabled curve sources, in the order of the registry and
// of Describe.
func (m *Module) Curves(ctx context.Context) ([]Curve, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	out := []Curve{}

	for _, src := range m.feeds.Curves {
		if !on[src.ID()] {
			continue
		}

		for _, info := range src.Describe() {
			c, err := m.storedCurve(ctx, src.ID(), info)
			if err != nil {
				return nil, err
			}

			if len(c.Points) > 0 {
				out = append(out, c)
			}
		}
	}

	return out, nil
}

// tickCurves runs the enabled curve sources.
func (m *Module) tickCurves(ctx context.Context, on map[string]bool) {
	for _, src := range m.feeds.Curves {
		if on[src.ID()] {
			err := m.tickCurve(ctx, src)
			if err != nil {
				m.logFeed(ctx, err, "source", src.ID())
			}

			m.ran(src.ID(), err)
		}
	}
}

// tickCurve replaces the stored points of each fetched curve with the file of the source.
func (m *Module) tickCurve(ctx context.Context, src curve.Source) error {
	curves, err := src.Fetch(ctx)
	if err != nil {
		return err
	}

	if len(curves) == 0 {
		return nil
	}

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	for _, c := range curves {
		if err := storeCurve(ctx, q, src.ID(), c); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func storeCurve(ctx context.Context, q *postgres.Queries, source string, c curve.Curve) error {
	if err := q.DeleteCurvePoints(ctx, c.ID); err != nil {
		return fmt.Errorf("delete the points of %s: %w", c.ID, err)
	}

	for _, p := range c.Points {
		var rate pgtype.Numeric
		if err := rate.Scan(p.Rate); err != nil {
			return fmt.Errorf("point of %s: %w", p.Maturity.Format("2006-01-02"), err)
		}

		if err := q.InsertCurvePoint(ctx, postgres.InsertCurvePointParams{
			CurveID:  c.ID,
			Maturity: p.Maturity,
			Rate:     rate,
			BaseDate: c.Base,
			Source:   source,
		}); err != nil {
			return fmt.Errorf("store the point of %s: %w", p.Maturity.Format("2006-01-02"), err)
		}
	}

	return nil
}

// curveFeeds appends the curve sources to out.
func (m *Module) curveFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	for _, src := range m.feeds.Curves {
		latest, err := m.q.LatestCurveBase(ctx, src.ID())
		if err != nil {
			return nil, fmt.Errorf("read the latest base date of %s: %w", src.ID(), err)
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
				domain.FeedCurve,
				index.PeriodDay,
				last,
				fs.on,
				fs.suggested,
				fs.lags,
			),
		)
	}

	return out, nil
}

// storedCurve reads the points of one curve of a source; Points is empty when none is stored.
func (m *Module) storedCurve(ctx context.Context, source string, info curve.Info) (Curve, error) {
	rows, err := m.q.ListCurvePoints(ctx, info.ID)
	if err != nil {
		return Curve{}, fmt.Errorf("list the points of %s: %w", info.ID, err)
	}

	c := Curve{
		ID:       info.ID,
		Kind:     info.Kind,
		Index:    info.Index,
		Currency: info.Currency,
		Source:   source,
		Points:   make([]domain.CurvePoint, len(rows)),
	}

	for i, r := range rows {
		v, err := r.Rate.Value()
		if err != nil {
			return Curve{}, fmt.Errorf(
				"point of %s: %w",
				r.Maturity.Format("2006-01-02"),
				err,
			)
		}

		c.Base = r.BaseDate
		c.Points[i] = domain.CurvePoint{Maturity: r.Maturity, Rate: fmt.Sprint(v)}
	}

	return c, nil
}
