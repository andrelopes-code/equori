package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Service) card(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (domain.Account, error) {
	a, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return domain.Account{}, err
	}

	return a, domain.RequireCard(a)
}

func (s *Service) AddBillingRule(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	r domain.BillingCycleRule,
) (domain.BillingCycleRule, error) {
	if _, err := s.card(ctx, booksID, accountID); err != nil {
		return domain.BillingCycleRule{}, err
	}

	if r.Calendar == "" {
		p, err := s.profiles.Profile(ctx, booksID)
		if err != nil {
			return domain.BillingCycleRule{}, fmt.Errorf("read profile: %w", err)
		}

		r.Calendar = s.cal.DefaultCalendar(p.Region)
	}

	rule, err := domain.NewBillingCycleRule(r)
	if err != nil {
		return domain.BillingCycleRule{}, err
	}

	if _, err := s.cal.Adjust(ctx, rule.Calendar, s.clock.Today(ctx), "none"); err != nil {
		return domain.BillingCycleRule{}, validationError("calendar", "is not a known calendar")
	}

	var created domain.BillingCycleRule
	err = s.repo.InTx(ctx, func(tx Repository) error {
		if created, err = tx.InsertBillingRule(ctx, booksID, accountID, rule); err != nil {
			return err
		}

		return s.redateOpenStatements(ctx, tx, booksID, accountID, rule.EffectiveFrom)
	})

	return created, err
}

// redateOpenStatements applies a new rule version to statements that have not closed
// yet; their postings stay on the same reference month.
func (s *Service) redateOpenStatements(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
	from domain.ReferenceMonth,
) error {
	rules, err := r.BillingRules(ctx, booksID, accountID)
	if err != nil {
		return err
	}

	open, err := r.OpenStatementsFrom(ctx, booksID, accountID, from, s.clock.Today(ctx))
	if err != nil {
		return err
	}

	for _, st := range open {
		rule, err := rules.For(st.Input.Reference)
		if err != nil {
			return err
		}

		dates := domain.DatesFor(st.Input.Reference, rule)

		due, err := s.cal.Adjust(ctx, rule.Calendar, dates.DueUnadjusted, rule.Adjustment)
		if err != nil {
			return err
		}

		if err := r.UpdateStatementDates(
			ctx,
			st.ID,
			s.shiftClosing(ctx, dates.Closing, rule),
			due,
		); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) BillingRules(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (domain.Rules, error) {
	if _, err := s.card(ctx, booksID, accountID); err != nil {
		return nil, err
	}

	return s.repo.BillingRules(ctx, booksID, accountID)
}

func (s *Service) AddCreditLimit(
	ctx context.Context,
	booksID int64,
	l CreditLimit,
) (CreditLimit, error) {
	a, err := s.card(ctx, booksID, l.AccountID)
	if err != nil {
		return CreditLimit{}, err
	}

	if l.Amount.Currency() != a.Instrument || l.Amount.Amount() <= 0 {
		return CreditLimit{}, &domain.FieldError{
			Field:   "amount",
			Message: "must be positive and in the card currency",
			Err:     domain.ErrValidation,
		}
	}

	return s.repo.InsertCreditLimit(ctx, booksID, l)
}

func (s *Service) CreditLimits(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) ([]CreditLimit, error) {
	if _, err := s.card(ctx, booksID, accountID); err != nil {
		return nil, err
	}

	return s.repo.CreditLimits(ctx, booksID, accountID)
}

// AddCard creates a card; a nil foreignChargeBP takes the default of the owner's region.
func (s *Service) AddCard(
	ctx context.Context,
	booksID int64,
	c domain.Card,
	foreignChargeBP *int,
) (domain.Card, error) {
	if _, err := s.card(ctx, booksID, c.AccountID); err != nil {
		return domain.Card{}, err
	}

	c.BooksID = booksID
	if foreignChargeBP != nil {
		c.ForeignChargeBP = *foreignChargeBP
	} else {
		bp, err := s.regionForeignChargeBP(ctx, booksID)
		if err != nil {
			return domain.Card{}, err
		}

		c.ForeignChargeBP = bp
	}

	c, err := domain.NewCard(c)
	if err != nil {
		return domain.Card{}, err
	}

	return s.repo.InsertCard(ctx, c)
}

func (s *Service) regionForeignChargeBP(ctx context.Context, booksID int64) (int, error) {
	p, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return 0, fmt.Errorf("read profile: %w", err)
	}

	return s.defaults.ForeignChargeBP(p.Region), nil
}

// cardForeignChargeBP reads the rate from the first active card of the account; an account
// without an active card takes the default of the owner's region.
func (s *Service) cardForeignChargeBP(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
) (int, error) {
	cards, err := r.Cards(ctx, booksID, accountID)
	if err != nil {
		return 0, err
	}

	for _, c := range cards {
		if c.Active {
			return c.ForeignChargeBP, nil
		}
	}

	return s.regionForeignChargeBP(ctx, booksID)
}

func (s *Service) Cards(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) ([]domain.Card, error) {
	if _, err := s.card(ctx, booksID, accountID); err != nil {
		return nil, err
	}

	return s.repo.Cards(ctx, booksID, accountID)
}

// EditCard changes the holder, the last four digits or the active flag of a card.
func (s *Service) EditCard(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	e domain.CardEdit,
) (domain.Card, error) {
	e, err := domain.NewCardEdit(e)
	if err != nil {
		return domain.Card{}, err
	}

	return s.repo.UpdateCard(ctx, booksID, id, e)
}

func (s *Service) DeleteCard(ctx context.Context, booksID int64, id uuid.UUID) error {
	return s.repo.DeleteCard(ctx, booksID, id)
}

// CardSummary returns nil when the card has no credit limit in force today. The available
// limit subtracts the whole debt, unbilled installments included, as issuers do.
func (s *Service) CardSummary(
	ctx context.Context,
	booksID int64,
	a domain.Account,
) (*CardSummary, error) {
	if a.Kind != domain.KindCreditCard {
		return nil, nil
	}

	limits, err := s.repo.CreditLimits(ctx, booksID, a.ID)
	if err != nil {
		return nil, err
	}

	today := s.clock.Today(ctx)

	var current *CreditLimit
	for i := range limits {
		if !limits[i].EffectiveFrom.After(today) {
			current = &limits[i]
		}
	}

	if current == nil {
		return nil, nil
	}

	totals, err := s.repo.AccountTotals(ctx, booksID, a.ID)
	if err != nil {
		return nil, err
	}

	available, err := money.New(current.Amount.Amount()+totals.Total, a.Instrument)
	if err != nil {
		return nil, err
	}

	return &CardSummary{CreditLimit: current.Amount, AvailableLimit: available}, nil
}

// AnticipatePlan moves installments from..to to the target statement for amount; the
// difference to their sum is a discount (M26, S15).
func (s *Service) AnticipatePlan(
	ctx context.Context,
	booksID int64,
	planID uuid.UUID,
	date time.Time,
	from, to int,
	target domain.ReferenceMonth,
	amount money.Money,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		plan, pu, installments, err := s.lockPlan(ctx, r, booksID, planID)
		if err != nil {
			return err
		}

		anticipated, err := s.loadAnticipated(ctx, r, booksID, plan, pu, from, to)
		if err != nil {
			return err
		}

		postings, sum, err := anticipationPostings(pu, installments, anticipated, date, from, to)
		if err != nil {
			return err
		}

		postings, err = s.addAnticipationCharge(ctx, r, booksID, pu, postings, sum, amount, target)
		if err != nil {
			return err
		}

		created, err = s.insertAnticipation(ctx, r, booksID, pu, date, postings)

		return err
	})

	return created, err
}

// loadAnticipated checks the installment range and the state of the plan, then returns the
// statements earlier anticipations credited.
func (s *Service) loadAnticipated(
	ctx context.Context,
	r Repository,
	booksID int64,
	plan domain.InstallmentPlan,
	pu purchase,
	from, to int,
) (map[domain.ReferenceMonth]struct{}, error) {
	if from < 1 || to < from || to > plan.Count {
		return nil, validationError(
			"from_installment",
			fmt.Sprintf("installments must be within 1..%d", plan.Count),
		)
	}

	cancelled, _, err := r.PlanState(ctx, booksID, pu.tx.ID)
	if err != nil {
		return nil, err
	}

	if cancelled {
		return nil, validationError("from_installment", "the plan is cancelled")
	}

	return r.AnticipatedReferences(ctx, booksID, pu.tx.ID)
}

// anticipationPostings returns the card postings that reverse installments from..to and their sum.
func anticipationPostings(
	pu purchase,
	installments []PlanInstallment,
	anticipated map[domain.ReferenceMonth]struct{},
	date time.Time,
	from, to int,
) ([]domain.Posting, int64, error) {
	var postings []domain.Posting

	var sum int64
	for _, in := range installments {
		if in.Number < from || in.Number > to {
			continue
		}

		if !in.Closing.After(date) {
			return nil, 0, validationError(
				"from_installment",
				fmt.Sprintf("installment %d is already billed", in.Number),
			)
		}

		if _, ok := anticipated[in.Reference]; ok {
			return nil, 0, validationError(
				"from_installment",
				fmt.Sprintf("installment %d is already anticipated", in.Number),
			)
		}

		ref := in.Reference

		m, err := money.New(-in.Amount, pu.card.Instrument)
		if err != nil {
			return nil, 0, err
		}

		sum -= in.Amount
		postings = append(
			postings,
			domain.Posting{
				AccountID: pu.card.ID,
				Amount:    m,
				CardRole:  domain.RoleCredit,
				Statement: &ref,
			},
		)
	}

	return postings, sum, nil
}

// addAnticipationCharge validates amount against sum, then appends the charge on target and
// the discount.
func (s *Service) addAnticipationCharge(
	ctx context.Context,
	r Repository,
	booksID int64,
	pu purchase,
	postings []domain.Posting,
	sum int64,
	amount money.Money,
	target domain.ReferenceMonth,
) ([]domain.Posting, error) {
	if amount.Currency() != pu.card.Instrument || amount.Amount() <= 0 || amount.Amount() > sum {
		return nil, validationError(
			"amount",
			fmt.Sprintf("must be positive and at most the installments' sum %d", sum),
		)
	}

	postings = append(
		postings,
		domain.Posting{
			AccountID: pu.card.ID,
			Amount:    amount.Neg(),
			CardRole:  domain.RoleCharge,
			Statement: &target,
		},
	)
	if discount := sum - amount.Amount(); discount > 0 {
		discounts, err := r.SystemAccount(ctx, booksID, domain.RoleDiscounts)
		if err != nil {
			return nil, err
		}

		m, err := money.New(-discount, pu.card.Instrument)
		if err != nil {
			return nil, err
		}

		postings = append(postings, domain.Posting{AccountID: discounts.ID, Amount: m})
	}

	return postings, nil
}

func (s *Service) insertAnticipation(
	ctx context.Context,
	r Repository,
	booksID int64,
	pu purchase,
	date time.Time,
	postings []domain.Posting,
) (domain.Transaction, error) {
	w, err := s.writerFor(ctx, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	return s.insert(ctx, r, domain.Transaction{
		BooksID:     booksID,
		Date:        date,
		Description: fmt.Sprintf(w.Anticipation, pu.tx.Description),
		PayeeID:     pu.tx.PayeeID,
		Postings:    postings,
		Links:       []domain.Link{{Type: domain.LinkAnticipationOf, Target: pu.tx.ID}},
	})
}
