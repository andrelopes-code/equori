package marketdata

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/sentiment"
	"github.com/andrelopes-code/equori/internal/marketdata/sentiment/alternativeme"
)

type SentimentIndex = domain.SentimentIndex

var ErrUnknownSentiment = domain.ErrUnknownSentiment

type sentimentEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of the day after a value by which the next
	// one is due (ADR 025 F9).
	lag   int
	build func(hc *http.Client, url string) sentiment.Source
}

func sentimentEntries() []sentimentEntry {
	return []sentimentEntry{
		{
			"alternative_me",
			"https://api.alternative.me",
			1,
			func(hc *http.Client, url string) sentiment.Source { return alternativeme.New(hc, url) },
		},
	}
}

// SentimentSourceIDs lists the sentiment sources; an admin enables them.
func SentimentSourceIDs() []string {
	entries := sentimentEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewSentimentSources builds every sentiment source; urls overrides a source's base URL.
func NewSentimentSources(urls map[string]string, hc *http.Client) []sentiment.Source {
	entries := sentimentEntries()

	out := make([]sentiment.Source, len(entries))
	for i, e := range entries {
		url := urls[e.id]
		if url == "" {
			url = e.defaultURL
		}

		out[i] = e.build(hc, url)
	}

	return out
}

// WithSentimentDemand sets how a tick learns whether a book reads an index; without it no source
// is asked (CO17). The composition root calls it once.
func (m *Module) WithSentimentDemand(
	inUse func(ctx context.Context, index string) (bool, error),
) *Module {
	m.sentimentInUse = inUse
	return m
}

// Sentiment returns the stored series of an index of the registry.
func (m *Module) Sentiment(ctx context.Context, id string) (SentimentIndex, error) {
	out, err := m.LatestSentiment(ctx, id)
	if err != nil {
		return SentimentIndex{}, err
	}

	rows, err := m.q.CountSentiment(ctx, id)
	if err != nil {
		return SentimentIndex{}, fmt.Errorf("count the values of %s: %w", id, err)
	}

	for _, r := range rows {
		out.Counts[r.Value] = int(r.Days)
		out.Days += int(r.Days)

		if out.Since == nil || r.First.Before(*out.Since) {
			out.Since = &r.First
		}
	}

	return out, nil
}

// LatestSentiment is Sentiment without the counts.
func (m *Module) LatestSentiment(ctx context.Context, id string) (SentimentIndex, error) {
	src, ok := m.sentimentSource(id)
	if !ok {
		return SentimentIndex{}, ErrUnknownSentiment
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return SentimentIndex{}, err
	}

	out := SentimentIndex{ID: id, Enabled: on[src.ID()]}

	out.Latest, err = m.latestSentiment(ctx, id)

	return out, err
}

// WantSentiment asks for a run of the source of an index without the value of today.
func (m *Module) WantSentiment(ctx context.Context, id string) error {
	s, err := m.LatestSentiment(ctx, id)
	if err != nil {
		return err
	}

	if s.Enabled && (s.Latest == nil || s.Latest.Date.Before(m.feeds.Clock.Today(ctx))) {
		src, _ := m.sentimentSource(id)
		m.want(src.ID())
	}

	return nil
}

func (m *Module) sentimentSource(id string) (sentiment.Source, bool) {
	for _, src := range m.feeds.Sentiments {
		if src.Index() == id {
			return src, true
		}
	}

	return nil, false
}

func (m *Module) latestSentiment(ctx context.Context, id string) (*domain.SentimentDay, error) {
	rows, err := m.q.LatestSentiment(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("read the latest value of %s: %w", id, err)
	}

	if len(rows) == 0 {
		return nil, nil
	}

	return &domain.SentimentDay{Date: rows[0].Date, Value: int(rows[0].Value)}, nil
}

// tickSentiment stores the days after the latest value, the whole series at first, of an index a
// book reads.
func (m *Module) tickSentiment(ctx context.Context, src sentiment.Source) error {
	inUse, err := m.sentimentWanted(ctx, src.Index())
	if err != nil || !inUse {
		return err
	}

	latest, err := m.latestSentiment(ctx, src.Index())
	if err != nil {
		return err
	}

	now := m.feeds.Clock.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	days := 0
	if latest != nil {
		// The latest day is read again: the source may revise it.
		days = max(1, int(today.Sub(latest.Date).Hours()/24)+1)
	}

	values, err := src.Fetch(ctx, days)
	if err != nil {
		return err
	}

	for _, v := range values {
		if v.Date.After(today) {
			return fmt.Errorf("%s: a value of %s", src.ID(), v.Date.Format(time.DateOnly))
		}
	}

	return m.storeSentiment(ctx, src, values)
}

func (m *Module) sentimentWanted(ctx context.Context, index string) (bool, error) {
	if m.sentimentInUse == nil {
		return false, nil
	}

	inUse, err := m.sentimentInUse(ctx, index)
	if err != nil {
		return false, fmt.Errorf("read the use of %s: %w", index, err)
	}

	return inUse, nil
}

func (m *Module) storeSentiment(
	ctx context.Context,
	src sentiment.Source,
	values []sentiment.Value,
) error {
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	for _, v := range values {
		if err := q.UpsertSentiment(ctx, postgres.UpsertSentimentParams{
			IndexID: src.Index(),
			Date:    v.Date,
			Value:   int16(v.Value), //nolint:gosec // G115: a source returns 0 to 100
			Source:  src.ID(),
		}); err != nil {
			return fmt.Errorf("store %s of %s: %w", src.Index(), v.Date.Format(time.DateOnly), err)
		}
	}

	return tx.Commit(ctx)
}

// sentimentFeeds appends the sentiment sources to out. A source no book reads is not late.
func (m *Module) sentimentFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	for _, src := range m.feeds.Sentiments {
		latest, err := m.latestSentiment(ctx, src.Index())
		if err != nil {
			return nil, err
		}

		var last *time.Time
		if latest != nil {
			last = &latest.Date
		}

		f := m.feed(
			ctx,
			src.ID(),
			domain.FeedSentiment,
			index.PeriodDay,
			last,
			fs.on,
			fs.suggested,
			fs.lags,
		)

		if f.Stale {
			if f.Stale, err = m.sentimentWanted(ctx, src.Index()); err != nil {
				return nil, err
			}
		}

		out = append(out, f)
	}

	return out, nil
}
