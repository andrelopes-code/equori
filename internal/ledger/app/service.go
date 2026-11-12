package app

import (
	"context"
	"time"
)

const (
	EventTransactionRecorded  = "ledger.transaction_recorded.v1"
	EventTransactionCorrected = "ledger.transaction_corrected.v1"
	EventTransactionVoided    = "ledger.transaction_voided.v1"
	EventAccountOpened        = "ledger.account_opened.v1"
	EventAccountClosed        = "ledger.account_closed.v1"
	EventAccountReopened      = "ledger.account_reopened.v1"
)

// earliestDate is the default opening date: accounts without a known opening date accept any posting.
var earliestDate = time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)

type Service struct {
	repo     Repository
	clock    Clock
	cal      Calendar
	ins      Instruments
	prices   Prices
	profiles Profiles
	defaults RegionDefaults
}

func NewService(
	repo Repository,
	clock Clock,
	cal Calendar,
	ins Instruments,
	prices Prices,
	profiles Profiles,
	defaults RegionDefaults,
) *Service {
	return &Service{
		repo:     repo,
		clock:    clock,
		cal:      cal,
		ins:      ins,
		prices:   prices,
		profiles: profiles,
		defaults: defaults,
	}
}

// Today is the date of the ledger's clock.
func (s *Service) Today(ctx context.Context) time.Time { return s.clock.Today(ctx) }
