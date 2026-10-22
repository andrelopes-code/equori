package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

const MaxFlowDays = 366

// ErrInvalidFlowRange: the range of Flows is empty or longer than MaxFlowDays (A119).
var ErrInvalidFlowRange = errors.New("invalid flow range")

type Flow struct {
	Date    time.Time
	Inflow  int64
	Outflow int64
}

// FlowRepository reads the flows of one account, without its sub-accounts.
type FlowRepository interface {
	AccountInstrument(ctx context.Context, userID int64, accountID uuid.UUID) (string, error)
	AccountFlows(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]Flow, error)
}

// Flows returns the days in [from, to] with a booked posting on the account, in its instrument.
func (s *Service) Flows(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]Flow, string, error) {
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 || days > MaxFlowDays {
		return nil, "", ErrInvalidFlowRange
	}
	instrument, err := s.repo.AccountInstrument(ctx, userID, accountID)
	if err != nil {
		return nil, "", err
	}
	flows, err := s.repo.AccountFlows(ctx, userID, accountID, from, to)
	if err != nil {
		return nil, "", err
	}
	return flows, instrument, nil
}
