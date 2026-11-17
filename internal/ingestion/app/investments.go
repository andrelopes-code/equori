package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// InvestmentView is a stored investment with the proposal of each movement, in the order of
// Movements.
type InvestmentView struct {
	domain.StoredInvestment
	Proposals []domain.Proposal
}

// Investments lists the investments of a connection with what each movement proposes. It
// returns ErrNotFound for a connection of another book.
func (s *Service) Investments(
	ctx context.Context,
	booksID int64,
	connectionID uuid.UUID,
) ([]InvestmentView, error) {
	if err := s.available(); err != nil {
		return nil, err
	}

	if _, err := s.repo.Connection(ctx, booksID, connectionID); err != nil {
		return nil, err
	}

	stored, err := s.repo.ConnectionInvestments(ctx, booksID, connectionID)
	if err != nil {
		return nil, err
	}

	out := make([]InvestmentView, len(stored))
	for i, inv := range stored {
		out[i] = InvestmentView{StoredInvestment: inv, Proposals: domain.Propose(inv.Movements)}
	}

	return out, nil
}
