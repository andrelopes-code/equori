// Package app maintains and reads the daily balance series (docs/domain, chapter 7, 7.7).
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

const MaxSeriesDays = 3660

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidRange = errors.New("invalid date range")
)

type Basis string

const (
	BasisBooked  Basis = "booked"
	BasisSettled Basis = "settled"
)

type DayDelta struct {
	Date    time.Time
	Booked  int64
	Settled int64
}

type AccountRef struct {
	UserID    int64
	AccountID uuid.UUID
}

type Point struct {
	Date    time.Time
	Balance int64
}

// Repository reads Ledger tables only through SELECT (ADR 002).
type Repository interface {
	AccountCurrency(ctx context.Context, userID int64, accountID uuid.UUID) (string, error)
	Rebuild(ctx context.Context, userID int64, accountID uuid.UUID, from time.Time) error
	TreeDailyDeltas(ctx context.Context, userID int64, accountID uuid.UUID, to time.Time) ([]DayDelta, error)
	AllAccounts(ctx context.Context) ([]AccountRef, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

// Series returns one point per day in [from, to], in the account currency.
func (s *Service) Series(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time, basis Basis) ([]Point, string, error) {
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 || days > MaxSeriesDays {
		return nil, "", ErrInvalidRange
	}
	currency, err := s.repo.AccountCurrency(ctx, userID, accountID)
	if err != nil {
		return nil, "", err
	}
	deltas, err := s.repo.TreeDailyDeltas(ctx, userID, accountID, to)
	if err != nil {
		return nil, "", err
	}
	var balance int64
	i := 0
	for ; i < len(deltas) && deltas[i].Date.Before(from); i++ {
		balance += deltas[i].pick(basis)
	}
	points := make([]Point, 0, days)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		for ; i < len(deltas) && !deltas[i].Date.After(d); i++ {
			balance += deltas[i].pick(basis)
		}
		points = append(points, Point{Date: d, Balance: balance})
	}
	return points, currency, nil
}

func (d DayDelta) pick(b Basis) int64 {
	if b == BasisSettled {
		return d.Settled
	}
	return d.Booked
}

// RebuildAccounts recomputes the series of each account from the given date on.
func (s *Service) RebuildAccounts(ctx context.Context, userID int64, accountIDs []uuid.UUID, from time.Time) error {
	for _, id := range accountIDs {
		if err := s.repo.Rebuild(ctx, userID, id, from); err != nil {
			return err
		}
	}
	return nil
}

// earliest precedes every accounting date the ledger accepts (ledger accounts open on 1900-01-01 at the earliest).
var earliest = time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)

func (s *Service) RebuildAll(ctx context.Context) error {
	refs, err := s.repo.AllAccounts(ctx)
	if err != nil {
		return err
	}
	for _, r := range refs {
		if err := s.repo.Rebuild(ctx, r.UserID, r.AccountID, earliest); err != nil {
			return err
		}
	}
	return nil
}
