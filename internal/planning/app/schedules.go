package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

type Service struct {
	repo     Repository
	ledger   Ledger
	cal      Calendar
	profiles Profiles
	prices   Prices
	returns  Returns
	clk      clock.Clock
}

func NewService(
	repo Repository,
	l Ledger,
	cal Calendar,
	profiles Profiles,
	prices Prices,
	returns Returns,
	clk clock.Clock,
) *Service {
	return &Service{
		repo:     repo,
		ledger:   l,
		cal:      cal,
		profiles: profiles,
		prices:   prices,
		returns:  returns,
		clk:      clk,
	}
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
	// GoalID names the goal that holds the counterpart by allocations; uuid.Nil without one
	// (planning coherence A255).
	GoalID      uuid.UUID
	Description string
	Amount      money.Money
	Rule        domain.Rule
	// Calendar defaults to the calendar of the owner's region when empty.
	Calendar string
	// ToleranceBP, GraceDays and WindowDays take their defaults when nil.
	ToleranceBP, GraceDays, WindowDays *int
	PaidBy                             uuid.UUID // uuid.Nil: none; realizes the occurrence on the rule's first date (plan B T3)
}

// ScheduleChange holds the description and the matching settings to change; a nil field keeps its value.
type ScheduleChange struct {
	Description *string
	// StartsOn moves the first date of the schedule earlier (A198).
	StartsOn                           *time.Time
	ToleranceBP, GraceDays, WindowDays *int
}

func (s *Service) CreateSchedule(
	ctx context.Context,
	booksID int64,
	in ScheduleInput,
) (domain.Schedule, error) {
	if in.Rule.Adjustment == "" {
		in.Rule.Adjustment = "none"
	}

	if in.Calendar == "" {
		calendar, err := s.defaultCalendar(ctx, booksID)
		if err != nil {
			return domain.Schedule{}, err
		}

		in.Calendar = calendar
	}

	if err := s.checkCalendar(ctx, in.Calendar); err != nil {
		return domain.Schedule{}, err
	}

	sch := newSchedule(in)
	if err := sch.Validate(); err != nil {
		return domain.Schedule{}, err
	}

	if err := s.checkAccounts(ctx, booksID, sch); err != nil {
		return domain.Schedule{}, err
	}

	// Nothing is generated yet: occurrences start at the rule's first date, which a preceding
	// adjustment may move before its start (A127).
	sch.GeneratedUntil = time.Time{}
	// The creation date bounds the skipped past (A127), so it follows the application clock.
	sch.CreatedAt = s.clk.Now()

	created, err := s.persistSchedule(ctx, booksID, sch, in.PaidBy)
	if err != nil {
		return domain.Schedule{}, err
	}

	return s.repo.Schedule(ctx, booksID, created.ID)
}

// defaultCalendar returns the calendar of the owner's region.
func (s *Service) defaultCalendar(ctx context.Context, booksID int64) (string, error) {
	p, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return "", fmt.Errorf("read profile: %w", err)
	}

	return s.cal.DefaultCalendar(p.Region), nil
}

// checkCalendar refuses a calendar the holiday source does not know.
func (s *Service) checkCalendar(ctx context.Context, calendar string) error {
	if _, err := s.cal.Holidays(
		ctx,
		calendar,
		s.clk.Today(ctx).Year(),
	); errors.Is(
		err,
		ErrUnknownCalendar,
	) {
		return &domain.FieldError{
			Field:   "calendar",
			Message: "is not a known calendar",
			Err:     domain.ErrValidation,
		}
	} else if err != nil {
		return fmt.Errorf("check calendar: %w", err)
	}

	return nil
}

// newSchedule builds the schedule of in, with the defaults of the matching settings.
func newSchedule(in ScheduleInput) domain.Schedule {
	sch := domain.Schedule{
		Calendar:      in.Calendar,
		Kind:          in.Kind,
		AccountID:     in.AccountID,
		CounterpartID: in.CounterpartID,
		PayeeID:       in.PayeeID,
		GoalID:        in.GoalID,
		Description:   in.Description,
		Currency:      in.Amount.Currency(),
		ToleranceBP:   domain.DefaultToleranceBP,
		GraceDays:     domain.DefaultGraceDays,
		WindowDays:    domain.DefaultWindowDays,
		Terms: []domain.Terms{
			{EffectiveFrom: in.Rule.Start, Rule: in.Rule, Amount: in.Amount.Amount()},
		},
	}
	if in.ToleranceBP != nil {
		sch.ToleranceBP = *in.ToleranceBP
	}

	if in.GraceDays != nil {
		sch.GraceDays = *in.GraceDays
	}

	if in.WindowDays != nil {
		sch.WindowDays = *in.WindowDays
	}

	return sch
}

// persistSchedule inserts sch and generates its occurrences in one transaction.
func (s *Service) persistSchedule(
	ctx context.Context,
	booksID int64,
	sch domain.Schedule,
	paidBy uuid.UUID,
) (domain.Schedule, error) {
	var created domain.Schedule

	err := s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		if created, err = repo.InsertSchedule(ctx, booksID, sch); err != nil {
			return err
		}

		return s.generate(ctx, repo, booksID, created, paidBy)
	})

	return created, err
}

// Update renames a schedule, ended or not, moves its start earlier and changes its matching
// settings. The matching applies to transactions recorded, corrected or voided afterwards;
// realized occurrences stay.
func (s *Service) Update(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	in ScheduleChange,
) (domain.Schedule, error) {
	return s.changeSchedule(ctx, booksID, id, func(repo Repository, sch *domain.Schedule) error {
		if in.Description != nil {
			sch.Description = *in.Description
		}

		if in.ToleranceBP != nil {
			sch.ToleranceBP = *in.ToleranceBP
		}

		if in.GraceDays != nil {
			sch.GraceDays = *in.GraceDays
		}

		if in.WindowDays != nil {
			sch.WindowDays = *in.WindowDays
		}

		if err := sch.Validate(); err != nil {
			return err
		}

		if _, err := repo.UpdateScheduleDescription(ctx, booksID, id, sch.Description); err != nil {
			return err
		}

		if _, err := repo.UpdateScheduleMatching(
			ctx,
			booksID,
			id,
			sch.ToleranceBP,
			sch.GraceDays,
			sch.WindowDays,
		); err != nil {
			return err
		}

		if in.StartsOn == nil {
			return nil
		}

		return s.moveStart(ctx, repo, booksID, *sch, *in.StartsOn)
	})
}

// checkAccounts applies the counterpart rule of P7 amendment A46 and the currency rule of
// P8 amendment A72: the amount is in the currency of account_id, and a transfer or savings
// counterpart holds that currency too.
func (s *Service) checkAccounts(ctx context.Context, booksID int64, sch domain.Schedule) error {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return err
	}

	accounts := make(map[uuid.UUID]Account, len(facts))
	for _, a := range facts {
		accounts[a.ID] = a
	}

	account, err := checkAccountSide(accounts, sch)
	if err != nil {
		return err
	}

	if err := checkCounterpart(accounts, sch, account); err != nil {
		return err
	}

	if err := s.checkScheduleGoal(ctx, booksID, sch); err != nil {
		return err
	}

	return s.checkPayee(ctx, booksID, sch)
}

// checkAccountSide checks the account of the schedule and returns it.
func checkAccountSide(accounts map[uuid.UUID]Account, sch domain.Schedule) (Account, error) {
	account, ok := accounts[sch.AccountID]
	if !ok || !isBalance(account) {
		return Account{}, &domain.FieldError{
			Field:   "account_id",
			Message: "must be a balance account of the book",
			Err:     domain.ErrValidation,
		}
	}

	if _, err := money.ParseCurrency(string(account.Instrument)); err != nil {
		return Account{}, &CurrencyError{Field: "account_id"}
	}

	if sch.Currency != account.Instrument {
		return Account{}, &domain.FieldError{
			Field:   "amount.currency",
			Message: "must be the currency of account_id " + string(account.Instrument),
			Err:     domain.ErrValidation,
		}
	}

	return account, nil
}

// checkCounterpart checks that the counterpart fits the kind and the instrument of account.
func checkCounterpart(accounts map[uuid.UUID]Account, sch domain.Schedule, account Account) error {
	counterpart, ok := accounts[sch.CounterpartID]

	var fits bool
	switch sch.Kind {
	case domain.Bill, domain.Subscription:
		fits = counterpart.Class == "expense"
	case domain.Income:
		fits = counterpart.Class == "income"
	case domain.Transfer, domain.Savings:
		fits = isBalance(counterpart) && counterpart.ID != sch.AccountID
	}

	if !ok || !fits {
		return &domain.FieldError{
			Field:   "counterpart_id",
			Message: "does not fit kind " + string(sch.Kind),
			Err:     domain.ErrValidation,
		}
	}

	if (sch.Kind == domain.Transfer || sch.Kind == domain.Savings) &&
		counterpart.Instrument != account.Instrument {
		return &CurrencyError{Field: "counterpart_id"}
	}

	return nil
}

// checkPayee checks that the payee of the schedule, when set, belongs to the book.
func (s *Service) checkPayee(ctx context.Context, booksID int64, sch domain.Schedule) error {
	if sch.PayeeID != uuid.Nil {
		missing, err := s.ledger.MissingPayees(ctx, booksID, []uuid.UUID{sch.PayeeID})
		if err != nil {
			return err
		}

		if len(missing) > 0 {
			return &domain.FieldError{
				Field:   "payee_id",
				Message: "is not a payee of the book",
				Err:     domain.ErrValidation,
			}
		}
	}

	return nil
}

func isBalance(a Account) bool { return a.Class == "asset" || a.Class == "liability" }

func (s *Service) Schedule(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Schedule, error) {
	return s.repo.Schedule(ctx, booksID, id)
}

func (s *Service) ListSchedules(
	ctx context.Context,
	booksID int64,
	p page.Request[IDKey],
) ([]domain.Schedule, *IDKey, error) {
	return s.repo.ListSchedules(ctx, booksID, p)
}
