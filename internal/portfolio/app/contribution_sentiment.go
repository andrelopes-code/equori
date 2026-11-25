package app

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// moods holds the latest value of each sentiment index the facts of a plan read, on one day.
type moods struct {
	readings map[string]domain.SentimentReading // by fact key
	today    time.Time
}

// SentimentInUse reports whether a criterion of any book reads the index (CO17).
func (s *Service) SentimentInUse(ctx context.Context, index string) (bool, error) {
	fact := domain.SentimentFact(index)
	if fact == "" {
		return false, nil
	}

	return s.repo.FactInUse(ctx, fact)
}

// sentiments reads each index the facts of p name.
func (s *Service) sentiments(ctx context.Context, p domain.Plan) (moods, error) {
	out := moods{
		readings: map[string]domain.SentimentReading{},
		today:    s.ledger.Today(ctx),
	}

	for fact, index := range sentimentsOf(p) {
		r, err := s.md.Sentiment(ctx, index)
		if err != nil {
			return moods{}, fmt.Errorf("read the sentiment index %s: %w", index, err)
		}

		out.readings[fact] = r
	}

	return out, nil
}

// wantSentiments asks for the value of today of each index the facts of p name.
func (s *Service) wantSentiments(ctx context.Context, p domain.Plan) error {
	for _, index := range sentimentsOf(p) {
		if err := s.md.WantSentiment(ctx, index); err != nil {
			return fmt.Errorf("ask for the sentiment index %s: %w", index, err)
		}
	}

	return nil
}

// sentimentsOf is the index of each sentiment fact of p, by fact key.
func sentimentsOf(p domain.Plan) map[string]string {
	out := map[string]string{}

	for _, c := range p.Classes {
		for _, fact := range c.QuestionFacts {
			if index, ok := domain.SentimentOf(fact); ok {
				out[fact] = index
			}
		}
	}

	return out
}

func (m moods) has(fact string) bool {
	_, ok := m.readings[fact]

	return ok
}

func (m moods) answer(fact, limit string) (domain.FactAnswer, domain.FactDetail) {
	return m.readings[fact].Answer(limit, m.today)
}
