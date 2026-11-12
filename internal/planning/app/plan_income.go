package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// receivedIncome returns, by occurrence id, the amount each realized income occurrence moved,
// read with one TransactionFacts call; an occurrence whose transaction is missing from the
// facts has no entry.
func (s *Service) receivedIncome(
	ctx context.Context,
	booksID int64,
	occurrences []domain.Occurrence,
	schedules map[uuid.UUID]domain.Schedule,
) (map[uuid.UUID]int64, error) {
	var ids []uuid.UUID
	for _, o := range occurrences {
		if o.State == domain.Realized && schedules[o.ScheduleID].Kind == domain.Income {
			ids = append(ids, o.TransactionID)
		}
	}

	if len(ids) == 0 {
		return nil, nil
	}

	facts, err := s.ledger.TransactionFacts(ctx, booksID, ids)
	if err != nil {
		return nil, err
	}

	byID := make(map[uuid.UUID]domain.Transaction, len(facts))
	for _, t := range facts {
		byID[t.ID] = t
	}

	out := make(map[uuid.UUID]int64, len(ids))

	for _, o := range occurrences {
		t, ok := byID[o.TransactionID]
		if o.State != domain.Realized || !ok || schedules[o.ScheduleID].Kind != domain.Income {
			continue
		}

		if amount, found := domain.ActualAmount(t, schedules[o.ScheduleID]); found {
			out[o.ID] = amount
		}
	}

	return out, nil
}
