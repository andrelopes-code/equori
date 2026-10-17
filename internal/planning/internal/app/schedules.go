package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

type Service struct {
	repo   Repository
	ledger Ledger
	cal    Calendar
	clk    clock.Clock
}

func NewService(repo Repository, l Ledger, cal Calendar, clk clock.Clock) *Service {
	return &Service{repo: repo, ledger: l, cal: cal, clk: clk}
}

// WithRepository returns the service on another repository, as outbox handlers need.
func (s *Service) WithRepository(repo Repository) *Service {
	c := *s
	c.repo = repo
	return &c
}

type ScheduleInput struct {
	Kind                     domain.Kind
	AccountID, CounterpartID uuid.UUID
	PayeeID                  uuid.UUID
	Description              string
	Amount                   money.Money
	Rule                     domain.Rule
	// ToleranceBP and GraceDays take their defaults when nil.
	ToleranceBP, GraceDays *int
}

func (s *Service) CreateSchedule(ctx context.Context, userID int64, in ScheduleInput) (domain.Schedule, error) {
	if in.Rule.Adjustment == "" {
		in.Rule.Adjustment = "none"
	}
	sch := domain.Schedule{
		Kind: in.Kind, AccountID: in.AccountID, CounterpartID: in.CounterpartID, PayeeID: in.PayeeID,
		Description: in.Description, Currency: in.Amount.Currency(),
		ToleranceBP: domain.DefaultToleranceBP, GraceDays: domain.DefaultGraceDays,
		Terms: []domain.Terms{{EffectiveFrom: in.Rule.Start, Rule: in.Rule, Amount: in.Amount.Amount()}},
	}
	if in.ToleranceBP != nil {
		sch.ToleranceBP = *in.ToleranceBP
	}
	if in.GraceDays != nil {
		sch.GraceDays = *in.GraceDays
	}
	if err := sch.Validate(); err != nil {
		return domain.Schedule{}, err
	}
	if err := s.checkAccounts(ctx, userID, sch); err != nil {
		return domain.Schedule{}, err
	}
	// Occurrences are generated from today; the rule produces no date before its start, except
	// one a preceding adjustment moves (Task 2 ruling).
	sch.GeneratedUntil = s.clk.Today().AddDate(0, 0, -1)
	var created domain.Schedule
	err := s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		if created, err = repo.InsertSchedule(ctx, userID, sch); err != nil {
			return err
		}
		return s.generate(ctx, repo, userID, created)
	})
	if err != nil {
		return domain.Schedule{}, err
	}
	return s.repo.Schedule(ctx, userID, created.ID)
}

// checkAccounts applies the counterpart rule of P7 amendment A46 and the currency rule of A47.
func (s *Service) checkAccounts(ctx context.Context, userID int64, sch domain.Schedule) error {
	base, err := s.ledger.BaseCurrency(ctx, userID)
	if err != nil {
		return err
	}
	if sch.Currency != base {
		return &domain.FieldError{Field: "amount.currency", Message: "must be the base currency " + string(base), Err: domain.ErrValidation}
	}
	facts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return err
	}
	accounts := make(map[uuid.UUID]Account, len(facts))
	for _, a := range facts {
		accounts[a.ID] = a
	}
	balance := func(a Account) bool { return a.Class == "asset" || a.Class == "liability" }
	account, ok := accounts[sch.AccountID]
	if !ok || !balance(account) {
		return &domain.FieldError{Field: "account_id", Message: "must be a balance account of the user", Err: domain.ErrValidation}
	}
	if account.Instrument != base {
		return &CurrencyError{Field: "account_id"}
	}
	counterpart, ok := accounts[sch.CounterpartID]
	var fits bool
	switch sch.Kind {
	case domain.Bill, domain.Subscription:
		fits = counterpart.Class == "expense"
	case domain.Income:
		fits = counterpart.Class == "income"
	case domain.Transfer, domain.Savings:
		fits = balance(counterpart) && counterpart.ID != sch.AccountID
	}
	if !ok || !fits {
		return &domain.FieldError{Field: "counterpart_id", Message: "does not fit kind " + string(sch.Kind), Err: domain.ErrValidation}
	}
	if counterpart.Instrument != base {
		return &CurrencyError{Field: "counterpart_id"}
	}
	if sch.PayeeID != uuid.Nil {
		missing, err := s.ledger.MissingPayees(ctx, userID, []uuid.UUID{sch.PayeeID})
		if err != nil {
			return err
		}
		if len(missing) > 0 {
			return &domain.FieldError{Field: "payee_id", Message: "is not a payee of the user", Err: domain.ErrValidation}
		}
	}
	return nil
}

func (s *Service) Schedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error) {
	return s.repo.Schedule(ctx, userID, id)
}

func (s *Service) ListSchedules(ctx context.Context, userID int64, p page.Request[IDKey]) ([]domain.Schedule, *IDKey, error) {
	return s.repo.ListSchedules(ctx, userID, p)
}

// maxRangeDays bounds an occurrence range (P7 Global Constraints).
const maxRangeDays = 366

// OccurrenceView is an occurrence with the state the API reads.
type OccurrenceView struct {
	domain.Occurrence
	Shown    domain.State
	Currency money.Currency
}

// Occurrences lists the occurrences with expected date in [from, to]; state filters by the
// state read, overdue included.
func (s *Service) Occurrences(ctx context.Context, userID int64, from, to time.Time, scheduleID uuid.UUID, state domain.State) ([]OccurrenceView, error) {
	if to.Before(from) || to.Sub(from) > maxRangeDays*24*time.Hour {
		return nil, &domain.FieldError{Field: "to", Message: "must be on or after from, at most 366 days later", Err: domain.ErrValidation}
	}
	schedules, err := s.repo.Schedules(ctx, userID)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
	for _, sch := range schedules {
		byID[sch.ID] = sch
	}
	os, err := s.repo.Occurrences(ctx, userID, from, to, scheduleID)
	if err != nil {
		return nil, err
	}
	today := s.clk.Today()
	out := make([]OccurrenceView, 0, len(os))
	for _, o := range os {
		sch := byID[o.ScheduleID]
		v := OccurrenceView{Occurrence: o, Shown: o.Shown(today, sch.GraceDays), Currency: sch.Currency}
		if state == "" || v.Shown == state {
			out = append(out, v)
		}
	}
	return out, nil
}
