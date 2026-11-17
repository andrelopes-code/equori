package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrMovementResolved       = errors.New("this movement was already resolved")
	ErrInvestmentNotApplied   = errors.New("confirm the first application of this investment first")
	ErrLaterMovementConfirmed = errors.New("undo the later movements of this investment first")
)

// ConfirmMovement records what the movement proposes in the ledger; brokerageID,
// cashAccountID and categoryID are uuid.Nil when not given.
func (s *Service) ConfirmMovement(
	ctx context.Context,
	booksID int64,
	movementID, brokerageID, cashAccountID, categoryID uuid.UUID,
) (MovementView, error) {
	return s.review(ctx, booksID, movementID, func(r reviewed) (resolution, error) {
		return s.confirm(ctx, booksID, r, brokerageID, cashAccountID, categoryID)
	})
}

// DismissMovement marks a pending movement dismissed; nothing is recorded.
func (s *Service) DismissMovement(
	ctx context.Context,
	booksID int64,
	movementID uuid.UUID,
) (MovementView, error) {
	return s.review(ctx, booksID, movementID, func(r reviewed) (resolution, error) {
		m := r.movement()
		if m.State != domain.MovementPending {
			return resolution{}, ErrMovementResolved
		}

		if r.proposal().Kind == domain.ProposalTaxOfSale {
			return resolution{}, noProposal()
		}

		return resolution{changes: []MovementChange{
			{ID: m.ID, State: domain.MovementDismissed, ApplicationID: m.ApplicationID},
		}}, nil
	})
}

// UndoMovement voids what a confirmed movement recorded, or reopens a dismissed one.
func (s *Service) UndoMovement(
	ctx context.Context,
	booksID int64,
	movementID uuid.UUID,
) (MovementView, error) {
	return s.review(ctx, booksID, movementID, func(r reviewed) (resolution, error) {
		return s.undo(ctx, booksID, r)
	})
}

func (s *Service) review(
	ctx context.Context,
	booksID int64,
	movementID uuid.UUID,
	decide func(reviewed) (resolution, error),
) (MovementView, error) {
	if err := s.available(); err != nil {
		return MovementView{}, err
	}

	first, err := s.repo.InvestmentOfMovement(ctx, booksID, movementID)
	if err != nil {
		return MovementView{}, err
	}

	unlock, err := s.repo.LockInvestment(ctx, first.ID)
	if err != nil {
		return MovementView{}, err
	}
	defer unlock()

	r, err := s.reload(ctx, booksID, movementID)
	if err != nil {
		return MovementView{}, err
	}

	res, err := decide(r)
	if err != nil {
		return MovementView{}, err
	}

	if err := s.repo.ResolveMovements(ctx, booksID, res.changes, res.link); err != nil {
		return MovementView{}, fmt.Errorf("resolve movements: %w", err)
	}

	r, err = s.reload(ctx, booksID, movementID)
	if err != nil {
		return MovementView{}, err
	}

	// A failed price leaves the confirmation standing; the next sync stores it.
	_ = s.confirmedPrice(ctx, booksID, r.inv)

	return MovementView{InvestmentID: r.inv.ID, Movement: r.movement(), Proposal: r.proposal()}, nil
}

func (s *Service) reload(
	ctx context.Context,
	booksID int64,
	movementID uuid.UUID,
) (reviewed, error) {
	inv, err := s.repo.InvestmentOfMovement(ctx, booksID, movementID)
	if err != nil {
		return reviewed{}, err
	}

	r := reviewed{inv: inv, proposals: domain.Propose(inv.Movements)}
	for i, m := range inv.Movements {
		if m.ID == movementID {
			r.index = i
		}
	}

	return r, nil
}

func (s *Service) confirm(
	ctx context.Context,
	booksID int64,
	r reviewed,
	brokerageID, cashAccountID, categoryID uuid.UUID,
) (resolution, error) {
	kind := r.proposal().Kind
	if kind == domain.ProposalNone || kind == domain.ProposalTaxOfSale {
		return resolution{}, noProposal()
	}

	if r.movement().State != domain.MovementPending {
		return resolution{}, ErrMovementResolved
	}

	switch kind {
	case domain.ProposalApplication:
		return s.confirmApplication(ctx, booksID, r, brokerageID, cashAccountID)
	case domain.ProposalContribution, domain.ProposalSale, domain.ProposalIncome:
		if r.inv.Instrument == nil || r.inv.AccountID == nil || r.inv.BrokerageID == nil {
			return resolution{}, ErrInvestmentNotApplied
		}

		return s.confirmFollowing(ctx, booksID, r, categoryID)
	}

	return resolution{}, noProposal()
}

func (s *Service) confirmApplication(
	ctx context.Context,
	booksID int64,
	r reviewed,
	brokerageID, cashAccountID uuid.UUID,
) (resolution, error) {
	a, err := newApplication(r, brokerageID, cashAccountID)
	if err != nil {
		return resolution{}, err
	}

	res, err := s.ledger.ApplyInvestment(ctx, booksID, a)
	if err != nil {
		return resolution{}, err
	}

	instrument := string(res.Instrument)

	return resolution{
		changes: []MovementChange{confirmed(r.movement(), &res.TransactionID)},
		link: &InvestmentLink{
			InvestmentID: r.inv.ID,
			BrokerageID:  &brokerageID,
			AccountID:    &res.AccountID,
			Instrument:   &instrument,
		},
	}, nil
}

func (s *Service) confirmFollowing(
	ctx context.Context,
	booksID int64,
	r reviewed,
	categoryID uuid.UUID,
) (resolution, error) {
	m, p := r.movement(), r.proposal()

	txID, err := s.record(ctx, booksID, r, categoryID)
	if err != nil {
		return resolution{}, err
	}

	res := resolution{changes: []MovementChange{confirmed(m, &txID)}}
	if p.Kind == domain.ProposalSale {
		res.changes = append(res.changes, taxChanges(r, domain.MovementConfirmed)...)
	}

	return res, nil
}

// record writes the order of a contribution, a sale or an income and returns its transaction.
func (s *Service) record(
	ctx context.Context,
	booksID int64,
	r reviewed,
	categoryID uuid.UUID,
) (uuid.UUID, error) {
	m, inv, p := r.movement(), r.inv, r.proposal()
	amount := absolute(m.Amount)

	var (
		txID uuid.UUID
		err  error
	)

	switch p.Kind {
	case domain.ProposalContribution:
		var res AppliedInvestment

		res, err = s.ledger.ApplyInvestment(ctx, booksID, InvestmentApplication{
			ApplicationID: m.ApplicationID,
			BrokerageID:   *inv.BrokerageID,
			On:            m.Date,
			Amount:        amount,
			Instrument:    money.Currency(*inv.Instrument),
		})
		txID = res.TransactionID
	case domain.ProposalSale:
		var taxes money.Money

		if taxes, err = money.New(p.Taxes, amount.Currency()); err == nil {
			txID, err = s.ledger.SellInvestment(ctx, booksID, InvestmentSale{
				AccountID:  *inv.AccountID,
				Instrument: money.Currency(*inv.Instrument),
				On:         m.Date,
				Amount:     amount,
				Taxes:      taxes,
			})
		}
	default:
		if categoryID == uuid.Nil {
			return uuid.Nil, &domain.FieldError{
				Field: "category_id", Message: "is required to confirm an income",
			}
		}

		txID, err = s.ledger.InvestmentIncome(ctx, booksID, InvestmentIncome{
			AccountID: *inv.AccountID, CategoryID: categoryID, On: m.Date, Gross: amount,
		})
	}

	return txID, err
}

// newApplication builds the first application of an investment from its source facts.
func newApplication(
	r reviewed,
	brokerageID, cashAccountID uuid.UUID,
) (InvestmentApplication, error) {
	if brokerageID == uuid.Nil {
		return InvestmentApplication{}, &domain.FieldError{
			Field: "brokerage_id", Message: "is required to confirm the first application",
		}
	}

	m, src := r.movement(), r.inv.Source
	if src.Subtype == "" {
		// The ledger service accepts an empty subtype; the HTTP application requires it.
		return InvestmentApplication{}, &LedgerRefusal{
			Code:    "contract_invalid",
			Field:   "subtype",
			Message: "the aggregator's subtype has no equivalent",
		}
	}

	a := InvestmentApplication{
		ApplicationID: m.ApplicationID,
		BrokerageID:   brokerageID,
		CashAccountID: cashAccountID,
		On:            m.Date,
		Amount:        absolute(m.Amount),
		Subtype:       src.Subtype,
		Name:          src.Name,
		Issuer:        src.Issuer,
		IssuerScheme:  src.IssuerScheme,
		IssuerID:      src.IssuerID,
		IssuedOn:      m.Date,
	}

	if src.IssuedOn != nil {
		a.IssuedOn = *src.IssuedOn
	}

	if src.MaturesOn != nil {
		a.MaturesOn = *src.MaturesOn
	}

	if src.HasTerms {
		a.IndexID, a.PercentOfIndexBP, a.SpreadBP = src.IndexID, src.PercentOfIndexBP, src.SpreadBP
	}

	return a, nil
}

func (s *Service) undo(ctx context.Context, booksID int64, r reviewed) (resolution, error) {
	m, p := r.movement(), r.proposal()

	switch {
	case p.Kind == domain.ProposalTaxOfSale:
		return resolution{}, noProposal()
	case m.State == domain.MovementPending:
		return resolution{}, ErrMovementResolved
	case m.State == domain.MovementDismissed:
		return resolution{changes: []MovementChange{reopened(m, m.ApplicationID)}}, nil
	case p.Kind == domain.ProposalApplication && otherConfirmed(r):
		return resolution{}, ErrLaterMovementConfirmed
	}

	if m.TransactionID != nil {
		err := s.ledger.VoidInvestment(ctx, booksID, *m.TransactionID)
		if err != nil && !errors.Is(err, ErrTransactionVoided) {
			return resolution{}, err
		}
	}

	next, err := uuid.NewV7()
	if err != nil {
		return resolution{}, err
	}

	res := resolution{
		changes: append(
			[]MovementChange{reopened(m, next)},
			taxChanges(r, domain.MovementPending)...),
	}
	if p.Kind == domain.ProposalApplication {
		res.link = &InvestmentLink{InvestmentID: r.inv.ID}
	}

	return res, nil
}

func noProposal() error {
	return &domain.FieldError{Field: "movement", Message: "has no proposal to act on"}
}
