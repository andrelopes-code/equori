package marketdata

import (
	"context"
	"fmt"
	"net/http"
	"slices"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/expectation"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/expectation/brfocus"
)

type IndexExpectations = domain.IndexExpectations

type expectationEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of the day after a survey by which the
	// next survey is due (ADR 025 F9, ADR 026 E4).
	lag   int
	build func(hc *http.Client, url string) expectation.Source
}

func expectationEntries() []expectationEntry {
	return []expectationEntry{
		{"br_focus", "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata", 9, func(hc *http.Client, url string) expectation.Source { return brfocus.New(hc, url) }},
	}
}

// ExpectationSourceIDs lists the expectation sources; an admin enables them on the settings
// screen (ADR 026 E4).
func ExpectationSourceIDs() []string {
	entries := expectationEntries()
	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}
	return ids
}

// NewExpectationSources builds every expectation source; urls overrides a source's base URL.
func NewExpectationSources(urls map[string]string, hc *http.Client) []expectation.Source {
	entries := expectationEntries()
	out := make([]expectation.Source, len(entries))
	for i, e := range entries {
		url := urls[e.id]
		if url == "" {
			url = e.defaultURL
		}
		out[i] = e.build(hc, url)
	}
	return out
}

// tickExpectation replaces the stored points of the source's index with its latest survey.
func (m *Module) tickExpectation(ctx context.Context, src expectation.Source) error {
	survey, err := src.Fetch(ctx)
	if err != nil {
		return err
	}
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := m.q.WithTx(tx)
	if err := q.DeleteIndexExpectations(ctx, src.Index()); err != nil {
		return fmt.Errorf("delete the expectations of %s: %w", src.Index(), err)
	}
	for _, p := range survey.Points {
		var rate pgtype.Numeric
		if err := rate.Scan(p.Rate); err != nil {
			return fmt.Errorf("expectation of %s: %w", p.Date.Format("2006-01-02"), err)
		}
		if err := q.InsertIndexExpectation(ctx, postgres.InsertIndexExpectationParams{
			IndexID: src.Index(), Date: p.Date, Rate: rate, SurveyDate: survey.Date, Source: src.ID(),
		}); err != nil {
			return fmt.Errorf("store the expectation of %s: %w", p.Date.Format("2006-01-02"), err)
		}
	}
	return tx.Commit(ctx)
}

// expectedIndexes are the indexes whose expectations an enabled source projects.
func (m *Module) expectedIndexes(on map[string]bool) []string {
	var out []string
	for _, src := range m.feeds.Expectations {
		if on[src.ID()] {
			out = append(out, src.Index())
		}
	}
	return out
}

// Expectations returns the latest survey of an index whose expectation source is enabled.
func (m *Module) Expectations(ctx context.Context, id string) (IndexExpectations, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return IndexExpectations{}, err
	}
	if !slices.Contains(m.expectedIndexes(on), id) {
		return IndexExpectations{}, domain.ErrUnknownIndex
	}
	rows, err := m.q.ListIndexExpectations(ctx, id)
	if err != nil {
		return IndexExpectations{}, fmt.Errorf("list the expectations of %s: %w", id, err)
	}
	if len(rows) == 0 {
		return IndexExpectations{}, domain.ErrUnknownIndex
	}
	out := IndexExpectations{SurveyDate: rows[0].SurveyDate, Points: make([]IndexRate, len(rows))}
	for i, r := range rows {
		v, err := r.Rate.Value()
		if err != nil {
			return IndexExpectations{}, fmt.Errorf("expectation of %s: %w", r.Date.Format("2006-01-02"), err)
		}
		out.Points[i] = IndexRate{Date: r.Date, Rate: fmt.Sprint(v)}
	}
	return out, nil
}
