package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// ErrColumnSuggesterUnavailable: no model answers now (A206).
var ErrColumnSuggesterUnavailable = errors.New("no language model can answer now")

// ColumnSuggester asks a model for the meaning of columns; it receives masked cells only.
type ColumnSuggester interface {
	SuggestColumns(ctx context.Context, sample domain.ColumnSample) (domain.ColumnPositions, error)
}

// SuggestColumns masks the sample, asks the model and validates its answer; it stores nothing.
func (s *Service) SuggestColumns(ctx context.Context, booksID int64, accountID uuid.UUID, sample domain.ColumnSample) (domain.ColumnSuggestion, error) {
	if _, err := s.ledger.ImportTarget(ctx, booksID, accountID); err != nil {
		return domain.ColumnSuggestion{}, err
	}

	if s.columns == nil {
		return domain.ColumnSuggestion{}, ErrColumnSuggesterUnavailable
	}

	answer, err := s.columns.SuggestColumns(ctx, domain.MaskSample(sample))
	if err != nil {
		return domain.ColumnSuggestion{}, err
	}

	var width int
	for _, row := range sample.Rows {
		width = max(width, len(row))
	}

	return domain.NewColumnSuggestion(answer, sample.Header, width)
}
