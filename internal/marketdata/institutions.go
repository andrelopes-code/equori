package marketdata

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/institution"
	"github.com/andrelopes-code/equori/internal/marketdata/institution/brifdata"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

type InstitutionIndicators = domain.InstitutionIndicators

// periodQuarter is the period of a feed published once a quarter.
const periodQuarter = "quarter"

type institutionEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of the quarter after the stored one by
	// which the next quarter is due (A237 I8).
	lag   int
	build func(hc *http.Client, url string) institution.Source
}

func institutionEntries() []institutionEntry {
	return []institutionEntry{
		{
			"br_ifdata",
			"https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata",
			120,
			func(hc *http.Client, url string) institution.Source { return brifdata.New(hc, url) },
		},
	}
}

// InstitutionSourceIDs lists the institution sources; an admin enables them on the settings
// screen (A237 I2).
func InstitutionSourceIDs() []string {
	entries := institutionEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewInstitutionSources builds every institution source; urls overrides a source's base URL.
func NewInstitutionSources(urls map[string]string, hc *http.Client) []institution.Source {
	entries := institutionEntries()

	out := make([]institution.Source, len(entries))
	for i, e := range entries {
		url := urls[e.id]
		if url == "" {
			url = e.defaultURL
		}

		out[i] = e.build(hc, url)
	}

	return out
}

// InstitutionIndicators returns the indicators an enabled source stored for an identifier of a
// scheme; domain.ErrUnknownInstitution when the source is disabled or holds no row.
func (m *Module) InstitutionIndicators(
	ctx context.Context, scheme, identifier string,
) (InstitutionIndicators, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return InstitutionIndicators{}, err
	}

	row, err := m.q.GetInstitutionIndicator(ctx, postgres.GetInstitutionIndicatorParams{
		Scheme: scheme, Identifier: identifier,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return InstitutionIndicators{}, domain.ErrUnknownInstitution
	}

	if err != nil {
		return InstitutionIndicators{}, fmt.Errorf("read the indicators of %s: %w", identifier, err)
	}

	src, ok := m.institutionSource(row.Source)
	if !ok || !on[row.Source] {
		return InstitutionIndicators{}, domain.ErrUnknownInstitution
	}

	return indicatorsOf(row, src.URL())
}

// tickInstitution replaces the stored indicators of the source with its latest period.
func (m *Module) tickInstitution(ctx context.Context, src institution.Source) error {
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
	if err := q.DeleteInstitutionIndicators(ctx, src.ID()); err != nil {
		return fmt.Errorf("delete the indicators of %s: %w", src.ID(), err)
	}

	for _, e := range snap.Entries {
		params, err := insertParams(src.ID(), snap, e)
		if err != nil {
			return err
		}

		if err := q.InsertInstitutionIndicator(ctx, params); err != nil {
			return fmt.Errorf("store the indicators of %s: %w", e.Identifier, err)
		}
	}

	return tx.Commit(ctx)
}

// institutionFeeds appends the institution sources to out.
func (m *Module) institutionFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	for _, src := range m.feeds.Institutions {
		latest, err := m.q.LatestInstitutionPeriod(ctx, src.ID())
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
				domain.FeedInstitution,
				periodQuarter,
				last,
				fs.on,
				fs.suggested,
				fs.lags,
			),
		)
	}

	return out, nil
}

func (m *Module) institutionSource(id string) (institution.Source, bool) {
	i := slices.IndexFunc(
		m.feeds.Institutions,
		func(s institution.Source) bool { return s.ID() == id },
	)
	if i < 0 {
		return nil, false
	}

	return m.feeds.Institutions[i], true
}

func insertParams(
	source string, snap institution.Snapshot, e institution.Entry,
) (postgres.InsertInstitutionIndicatorParams, error) {
	p := postgres.InsertInstitutionIndicatorParams{
		Scheme: e.Scheme, Identifier: e.Identifier, Source: source,
		Period: snap.Period, Currency: snap.Currency,
		ConglomerateCode: e.ConglomerateCode, ConglomerateName: e.ConglomerateName,
		Equity: e.Equity, NetIncome: e.NetIncome,
	}

	for _, f := range []struct {
		from *string
		to   *pgtype.Numeric
	}{
		{e.Basel, &p.Basel}, {e.PrincipalCapital, &p.PrincipalCapital}, {e.FixedAsset, &p.FixedAsset},
	} {
		if f.from == nil {
			continue
		}

		if err := f.to.Scan(*f.from); err != nil {
			return p, fmt.Errorf("indicator of %s: %w", e.Identifier, err)
		}
	}

	return p, nil
}

func indicatorsOf(
	row postgres.GetInstitutionIndicatorRow, url string,
) (InstitutionIndicators, error) {
	out := InstitutionIndicators{
		Source: row.Source, SourceURL: url, Period: row.Period, Currency: row.Currency,
		ConglomerateCode: row.ConglomerateCode, ConglomerateName: row.ConglomerateName,
		Equity: row.Equity, NetIncome: row.NetIncome,
	}

	for _, f := range []struct {
		from pgtype.Numeric
		to   **string
	}{
		{row.Basel, &out.Basel}, {row.PrincipalCapital, &out.PrincipalCapital},
		{row.FixedAsset, &out.FixedAsset},
	} {
		text, err := numericText(f.from)
		if err != nil {
			return InstitutionIndicators{}, fmt.Errorf(
				"indicator of %s: %w",
				row.ConglomerateCode,
				err,
			)
		}

		*f.to = text
	}

	return out, nil
}

// numericText returns the exact decimal text of v, or nil for null.
func numericText(v pgtype.Numeric) (*string, error) {
	if !v.Valid {
		return nil, nil //nolint:nilnil // a null indicator is not an error
	}

	value, err := v.Value()
	if err != nil {
		return nil, err
	}

	s := fmt.Sprint(value)

	return &s, nil
}
