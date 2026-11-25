package portfolio

import (
	"context"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// SentimentInUse reports whether a criterion of any book reads a sentiment index (CO17).
func (m *Module) SentimentInUse(ctx context.Context, index string) (bool, error) {
	return m.svc.SentimentInUse(ctx, index)
}

func (p marketPort) Sentiment(
	ctx context.Context,
	index string,
) (domain.SentimentReading, error) {
	x, err := p.md.LatestSentiment(ctx, index)
	if err != nil {
		return domain.SentimentReading{}, err
	}

	out := domain.SentimentReading{Enabled: x.Enabled}
	if x.Latest != nil {
		out.Value, out.Date = &x.Latest.Value, x.Latest.Date
	}

	return out, nil
}

func (p marketPort) WantSentiment(ctx context.Context, index string) error {
	return p.md.WantSentiment(ctx, index)
}
