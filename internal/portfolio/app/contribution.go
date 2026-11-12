package app

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const (
	missingPrice = "price"
	missingRate  = "rate"
)

var (
	ErrContributionTargetSum          = domain.ErrTargetSum
	ErrContributionMemberTargetSum    = domain.ErrMemberTargetSum
	ErrContributionClassNameDuplicate = domain.ErrClassNameDuplicate
	ErrContributionMemberDuplicate    = domain.ErrMemberDuplicate
	ErrContributionPlanInvalid        = domain.ErrPlanInvalid

	ErrContributionMemberInvalid = errors.New("invalid contribution member")
	ErrContributionAmountInvalid = errors.New("invalid contribution amount")
	ErrUnknownInstrument         = errors.New("unknown instrument")
)

// ContributionView is the contribution plan with its values at today (CN5 to CN10, CN13).
type ContributionView struct {
	Amount       *money.Money // stored amount in the base currency (CN11), or the preview amount
	Complete     bool         // false: Missing is not empty (CN10)
	Total        money.Money  // sum of class values; zero when incomplete
	TotalAfter   *money.Money // preview with Complete only
	DriftBP      *int         // nil when incomplete or total not positive
	DriftAfterBP *int         // preview with Complete only
	Classes      []ContributionClass
	Outside      []ContributionOutside
	Missing      []ContributionMissing
}

type ContributionClass struct {
	Name         string
	TargetBP     int
	Value        money.Money
	ShareBP      *int
	AfterShareBP *int
	Amount       *money.Money
	Members      []ContributionMember
}

type ContributionMember struct {
	AccountID    uuid.UUID
	Instrument   money.Currency
	TargetBP     *int
	Value        money.Money
	ShareBP      *int // inside its class
	AfterShareBP *int // inside its class
	UnitValue    *money.Money
	Amount       *money.Money // set for every member of a class with member targets
}

type ContributionOutside struct {
	AccountID  uuid.UUID      // set for a CN3 account
	Instrument money.Currency // set for a holding, summed across holding accounts
	Value      *money.Money   // nil without a price path
}

type ContributionMissing struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	Kind       string // "price" or "rate"
}

// ContributionPlan returns the stored plan valued at today; a book without a plan has no class.
func (s *Service) ContributionPlan(ctx context.Context, booksID int64) (ContributionView, error) {
	p, _, err := s.repo.ContributionPlan(ctx, booksID)
	if err != nil {
		return ContributionView{}, fmt.Errorf("read the contribution plan: %w", err)
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	if p.Amount != nil && p.Amount.Currency() != base {
		p.Amount = nil
	}

	ab, err := s.loadAccountBook(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	return s.contributionView(ctx, booksID, ab, p, base, false)
}

// SaveContributionPlan validates the plan as PreviewContribution does, with the amount optional,
// stores it and returns it as ContributionPlan does.
func (s *Service) SaveContributionPlan(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
) (ContributionView, error) {
	if err := p.Check(); err != nil {
		return ContributionView{}, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	if p.Amount != nil && p.Amount.Currency() != base {
		return ContributionView{}, ErrContributionAmountInvalid
	}

	ab, err := s.loadAccountBook(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	if err := s.validateMembers(ctx, ab, p); err != nil {
		return ContributionView{}, err
	}

	if err := s.repo.SaveContributionPlan(ctx, booksID, p); err != nil {
		return ContributionView{}, fmt.Errorf("store the contribution plan: %w", err)
	}

	return s.contributionView(ctx, booksID, ab, p, base, false)
}

// PreviewContribution values the plan p and splits amount over it without storing either.
func (s *Service) PreviewContribution(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
	amount money.Money,
) (ContributionView, error) {
	if err := p.Check(); err != nil {
		return ContributionView{}, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	if amount.Amount() <= 0 || amount.Currency() != base {
		return ContributionView{}, ErrContributionAmountInvalid
	}

	ab, err := s.loadAccountBook(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	if err := s.validateMembers(ctx, ab, p); err != nil {
		return ContributionView{}, err
	}

	p.Amount = &amount

	return s.contributionView(ctx, booksID, ab, p, base, true)
}

// PreviewSavedContribution is PreviewContribution of the stored plan; a book without a plan gets
// ContributionPlan.
func (s *Service) PreviewSavedContribution(
	ctx context.Context,
	booksID int64,
	amount money.Money,
) (ContributionView, error) {
	p, found, err := s.repo.ContributionPlan(ctx, booksID)
	if err != nil {
		return ContributionView{}, fmt.Errorf("read the contribution plan: %w", err)
	}

	if !found {
		return s.ContributionPlan(ctx, booksID)
	}

	return s.PreviewContribution(ctx, booksID, p, amount)
}

// accountBook is the accounts of a book indexed for the member rules of CN3 and CN6.
type accountBook struct {
	accounts []Account
	byID     map[uuid.UUID]Account
	hasChild map[uuid.UUID]bool
	types    map[money.Currency]string
}

func (s *Service) loadAccountBook(ctx context.Context, booksID int64) (accountBook, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return accountBook{}, err
	}

	ab := accountBook{
		accounts: accounts,
		byID:     make(map[uuid.UUID]Account, len(accounts)),
		hasChild: map[uuid.UUID]bool{},
		types:    map[money.Currency]string{},
	}
	for _, a := range accounts {
		ab.byID[a.ID] = a
		ab.hasChild[a.ParentID] = true
	}

	return ab, nil
}

// instrumentType returns the catalog type of code; ErrUnknownInstrument when it has none.
func (s *Service) instrumentType(
	ctx context.Context,
	ab accountBook,
	code money.Currency,
) (string, error) {
	if t, ok := ab.types[code]; ok {
		return t, nil
	}

	info, err := s.md.InstrumentOf(ctx, code)
	if err != nil {
		return "", err
	}

	ab.types[code] = info.Type

	return info.Type, nil
}

// validateMembers applies CN3: an account member is an asset account of kind savings, reserve or
// brokerage, without children, holding a currency; an instrument member is a security.
func (s *Service) validateMembers(ctx context.Context, ab accountBook, p domain.Plan) error {
	for _, c := range p.Classes {
		for _, m := range c.Members {
			if err := s.validateMember(ctx, ab, m); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Service) validateMember(ctx context.Context, ab accountBook, m domain.PlanMember) error {
	if m.AccountID == uuid.Nil {
		t, err := s.instrumentType(ctx, ab, m.Instrument)
		if errors.Is(err, ErrUnknownInstrument) || (err == nil && t == typeCurrency) {
			return ErrContributionMemberInvalid
		}

		return err
	}

	a, ok := ab.byID[m.AccountID]
	if !ok {
		return ErrContributionMemberInvalid
	}

	eligible, err := s.eligibleAccount(ctx, ab, a)
	if err != nil {
		return err
	}

	if !eligible {
		return ErrContributionMemberInvalid
	}

	return nil
}

// eligibleAccount reports whether a may be an account member (CN3).
func (s *Service) eligibleAccount(ctx context.Context, ab accountBook, a Account) (bool, error) {
	kinds := []string{"savings", "reserve", kindBrokerage}
	if a.Class != classAsset || !slices.Contains(kinds, a.Kind) || ab.hasChild[a.ID] {
		return false, nil
	}

	t, err := s.instrumentType(ctx, ab, a.Instrument)
	if err != nil {
		return false, err
	}

	return t == typeCurrency, nil
}

// missingKind is the item a conversion of instrument lacks: a rate for a currency, a price else.
func (s *Service) missingKind(ctx context.Context, ab accountBook, code money.Currency) string {
	if t, err := s.instrumentType(ctx, ab, code); err == nil && t == typeCurrency {
		return missingRate
	}

	return missingPrice
}
