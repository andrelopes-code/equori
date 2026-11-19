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
	ErrContributionRuleInvalid        = domain.ErrRuleInvalid

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
	Leftover     *money.Money // preview with an amount and Complete only (CN18)
	Classes      []ContributionClass
	Outside      []ContributionOutside
	Missing      []ContributionMissing
	Current      *CurrentQuotes // nil when no value took a current quote (A248 CQ24)

	GuaranteeName string // empty without a guarantee in the base currency (GR8)
}

type ContributionClass struct {
	Name           string
	TargetBP       int
	Questions      []string // the investor's yes-or-no questions (CQ1)
	QuestionIdeals bool     // the members' targets come from the answers, one at least true (CQ5)
	Value          money.Money
	ShareBP        *int
	AfterShareBP   *int
	Amount         *money.Money
	Cost           *money.Money // cash-like class: the amount of its order (CN17)
	Members        []ContributionMember
	Rules          []domain.PlanRule
	Matched        []ContributionMatched
}

// ContributionMatched is a security that a rule of a group takes (GR5, GR8).
type ContributionMatched struct {
	Instrument money.Currency
	Value      money.Money
	ShareBP    *int // inside its class; nil when the class value is zero or the view incomplete
}

type ContributionMember struct {
	AccountID    uuid.UUID
	Instrument   money.Currency
	TargetBP     *int
	Answers      []bool // one per question of the class (CQ2); nil without questions
	Value        money.Money
	ShareBP      *int // inside its class
	AfterShareBP *int // inside its class
	UnitValue    *money.Money
	Amount       *money.Money // set for every member of a class with member targets
	Quantity     *money.Money // instrument member with a unit value, at the instrument scale (CN17)
	Cost         *money.Money // set with Amount, in the base currency (CN17)
}

type ContributionOutside struct {
	AccountID  uuid.UUID      // set for a CN3 account
	Instrument money.Currency // set for a holding, summed across holding accounts
	Value      *money.Money   // nil without a price path
	ReturnKind string         // GR8; empty without one
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
	p, err := p.WithIdeals()
	if err != nil {
		return ContributionView{}, err
	}

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

	if err := s.validateRules(ctx, ab, p, base); err != nil {
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
	p, err := p.WithIdeals()
	if err != nil {
		return ContributionView{}, err
	}

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

	if err := s.validateRules(ctx, ab, p, base); err != nil {
		return ContributionView{}, err
	}

	p.Amount = &amount

	return s.contributionView(ctx, booksID, ab, p, base, true)
}

// PreviewDraft values the plan p without an amount, a split or a store (GR8).
func (s *Service) PreviewDraft(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
) (ContributionView, error) {
	p, err := p.WithIdeals()
	if err != nil {
		return ContributionView{}, err
	}

	if err := p.Check(); err != nil {
		return ContributionView{}, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	ab, err := s.loadAccountBook(ctx, booksID)
	if err != nil {
		return ContributionView{}, err
	}

	if err := s.validateMembers(ctx, ab, p); err != nil {
		return ContributionView{}, err
	}

	if err := s.validateRules(ctx, ab, p, base); err != nil {
		return ContributionView{}, err
	}

	return s.contributionView(ctx, booksID, ab, p, base, false)
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

	// The stored targets of a class with questions are derived; PreviewContribution derives them
	// again from the answers.
	for _, c := range p.Classes {
		if len(c.Questions) > 0 {
			for j := range c.Members {
				c.Members[j].TargetBP = nil
			}
		}
	}

	return s.PreviewContribution(ctx, booksID, p, amount)
}

// accountBook is the accounts of a book indexed for the member rules of CN3 and CN6.
type accountBook struct {
	booksID  int64
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
		booksID:  booksID,
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

	if info.BooksID != 0 && info.BooksID != ab.booksID {
		return "", ErrUnknownInstrument
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
