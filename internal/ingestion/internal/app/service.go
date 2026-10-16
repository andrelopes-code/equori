// Package app implements the ingestion use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var ErrNotFound = errors.New("not found")

type BatchKey struct {
	StartedAt time.Time `json:"gs"`
	ID        uuid.UUID `json:"gi"`
}

// Repository returns ErrNotFound for missing rows.
type Repository interface {
	ListBatches(ctx context.Context, userID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListBatches(ctx context.Context, userID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error) {
	return s.repo.ListBatches(ctx, userID, p)
}
