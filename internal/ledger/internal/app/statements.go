package app

import (
	"context"
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// Statements lists a card's statements within [from, to]; nil bounds are open. Pages are
// cut in memory: each summary carries the unpaid amount of the previous statement, so
// every statement of the card is summarized anyway. A zero Limit returns every statement.
func (s *Service) Statements(ctx context.Context, userID int64, accountID uuid.UUID, from, to *domain.ReferenceMonth, p page.Request[StatementKey]) ([]StatementView, *StatementKey, domain.Account, error) {
	a, err := s.card(ctx, userID, accountID)
	if err != nil {
		return nil, nil, domain.Account{}, err
	}
	all, err := s.statementSummaries(ctx, s.repo, userID, accountID)
	if err != nil {
		return nil, nil, domain.Account{}, err
	}
	out := make([]StatementView, 0, len(all))
	for _, v := range all {
		ref := v.Input.Reference
		if (from != nil && ref.Compare(*from) < 0) || (to != nil && ref.Compare(*to) > 0) ||
			(p.After != nil && ref.String() <= p.After.Reference) {
			continue
		}
		out = append(out, v)
	}
	if p.Limit == 0 || len(out) <= p.Limit {
		return out, nil, a, nil
	}
	out = out[:p.Limit]
	return out, &StatementKey{Reference: out[len(out)-1].Input.Reference.String()}, a, nil
}

func (s *Service) Statement(ctx context.Context, userID int64, id uuid.UUID) (StatementView, domain.Account, []StatementPosting, error) {
	accountID, err := s.repo.StatementAccount(ctx, userID, id)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}
	views, _, a, err := s.Statements(ctx, userID, accountID, nil, nil, page.Request[StatementKey]{})
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}
	postings, err := s.repo.StatementPostings(ctx, userID, id)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}
	for _, v := range views {
		if v.ID != id {
			continue
		}
		for i, p := range postings {
			postings[i].Provisional = domain.Provisional(p.Basis, p.Date, v.Input.Closing, v.Reconciled, p.Installment != nil)
		}
		v.Explanation = s.explain(v, postings)
		return v, a, postings, nil
	}
	return StatementView{}, domain.Account{}, nil, ErrNotFound
}

// explain searches the provisional postings of a closed, unreconciled statement for the ones
// that close its difference with the institution's total (A137).
func (s *Service) explain(v StatementView, postings []StatementPosting) domain.DifferenceExplanation {
	if v.Fact == nil || v.Reconciled || s.clock.Today().Before(v.Input.Closing) {
		return domain.DifferenceExplanation{}
	}

	// A transaction moves whole: its provisional postings on the statement are one candidate.
	var candidates []domain.DifferenceCandidate
	for _, p := range postings {
		if !p.Provisional || p.CardRole == domain.RolePayment {
			continue
		}

		i := slices.IndexFunc(candidates, func(c domain.DifferenceCandidate) bool { return c.TransactionID == p.TransactionID })
		if i < 0 {
			candidates = append(candidates, domain.DifferenceCandidate{TransactionID: p.TransactionID, Date: p.Date})
			i = len(candidates) - 1
		}
		candidates[i].Amount += p.Amount
	}

	return domain.ExplainDifference(v.Summary.AmountDue-v.Fact.Total, len(postings), candidates)
}
