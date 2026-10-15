package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// Statements lists a card's statements within [from, to]; nil bounds are open.
func (s *Service) Statements(ctx context.Context, userID int64, accountID uuid.UUID, from, to *domain.ReferenceMonth) ([]StatementView, domain.Account, error) {
	a, err := s.card(ctx, userID, accountID)
	if err != nil {
		return nil, domain.Account{}, err
	}
	all, err := s.statementSummaries(ctx, s.repo, userID, accountID)
	if err != nil {
		return nil, domain.Account{}, err
	}
	out := make([]StatementView, 0, len(all))
	for _, v := range all {
		ref := v.Input.Reference
		if (from != nil && ref.Compare(*from) < 0) || (to != nil && ref.Compare(*to) > 0) {
			continue
		}
		out = append(out, v)
	}
	return out, a, nil
}

func (s *Service) Statement(ctx context.Context, userID int64, id uuid.UUID) (StatementView, domain.Account, []StatementPosting, error) {
	accountID, err := s.repo.StatementAccount(ctx, userID, id)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}
	views, a, err := s.Statements(ctx, userID, accountID, nil, nil)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}
	postings, err := s.repo.StatementPostings(ctx, userID, id)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}
	for _, v := range views {
		if v.ID == id {
			return v, a, postings, nil
		}
	}
	return StatementView{}, domain.Account{}, nil, ErrNotFound
}
