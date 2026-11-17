package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

type accountEvent struct {
	AccountID uuid.UUID `json:"account_id"`
}

type AccountPatch struct {
	Name                  *string
	ParentID              *uuid.UUID
	InstitutionID         *uuid.UUID
	YieldMode             *domain.YieldMode
	ExcludedFromLiquidity *bool
	OpenedOn              *time.Time
	// Color is a theme data slot 1..8, 0 clears it; Icon is a key of domain.AccountIcons, "" clears it.
	Color *int
	Icon  *string
}

func (s *Service) CreateAccount(
	ctx context.Context,
	booksID int64,
	a domain.Account,
) (domain.Account, error) {
	if err := domain.ValidateIcon(a.Icon); err != nil {
		return domain.Account{}, err
	}

	a.BooksID = booksID
	if a.OpenedOn.IsZero() {
		a.OpenedOn = earliestDate
	}

	a.SystemRole = ""
	if err := s.describeInstrument(ctx, &a); err != nil {
		return domain.Account{}, err
	}

	a, err := domain.NewAccount(a)
	if err != nil {
		return domain.Account{}, err
	}

	var created domain.Account
	err = s.repo.InTx(ctx, func(r Repository) error {
		if err := s.checkParent(ctx, r, a); err != nil {
			return err
		}

		created, err = r.InsertAccount(ctx, a)
		if err != nil {
			return err
		}

		return r.Publish(
			ctx,
			outbox.Event{
				Type:        EventAccountOpened,
				BooksID:     booksID,
				AggregateID: created.ID.String(),
				Payload:     accountEvent{created.ID},
			},
		)
	})

	return created, err
}

func (s *Service) UpdateAccount(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	p AccountPatch,
) (domain.Account, error) {
	var updated domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		if err := applyAccountPatch(&a, p); err != nil {
			return err
		}

		if err := s.describeInstrument(ctx, &a); err != nil {
			return err
		}

		if a, err = domain.NewAccount(a); err != nil {
			return err
		}

		if err := s.checkParent(ctx, r, a); err != nil {
			return err
		}

		updated, err = r.UpdateAccount(ctx, a)

		return err
	})

	return updated, err
}

// applyAccountPatch copies the set fields of p onto a.
func applyAccountPatch(a *domain.Account, p AccountPatch) error {
	if p.Name != nil {
		a.Name = *p.Name
	}

	if p.ParentID != nil {
		a.ParentID = *p.ParentID
	}

	if p.InstitutionID != nil {
		a.InstitutionID = *p.InstitutionID
	}

	if p.YieldMode != nil {
		a.YieldMode = *p.YieldMode
	}

	if p.ExcludedFromLiquidity != nil {
		a.ExcludedFromLiquidity = *p.ExcludedFromLiquidity
	}

	if p.Color != nil {
		a.Color = *p.Color
	}

	if p.Icon != nil {
		if err := domain.ValidateIcon(*p.Icon); err != nil {
			return err
		}

		a.Icon = *p.Icon
	}

	// A210: a later opening date could strand postings before it.
	if p.OpenedOn != nil && p.OpenedOn.After(a.OpenedOn) {
		return validationError("opened_on", "can only move earlier")
	}

	if p.OpenedOn != nil {
		a.OpenedOn = *p.OpenedOn
	}

	return nil
}

// SetAppearance sets or, with zero values, clears the colour and the icon of an account (A83).
func (s *Service) SetAppearance(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	color int,
	icon string,
) (domain.Account, error) {
	if err := domain.ValidateIcon(icon); err != nil {
		return domain.Account{}, err
	}

	var updated domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		a.Color, a.Icon = color, icon
		if a, err = domain.NewAccount(a); err != nil {
			return err
		}

		updated, err = r.UpdateAccount(ctx, a)

		return err
	})

	return updated, err
}

// SetCardFace replaces the appearance of a credit card account; zero values clear it (card faces
// spec 4.9).
func (s *Service) SetCardFace(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	face domain.CardFace,
) (domain.Account, error) {
	var updated domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		if err = domain.RequireCard(a); err != nil {
			return err
		}

		if a.Face, err = domain.NewCardFace(face); err != nil {
			return err
		}

		updated, err = r.UpdateAccount(ctx, a)

		return err
	})

	return updated, err
}

func (s *Service) Account(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Account, error) {
	return s.repo.Account(ctx, booksID, id)
}

func (s *Service) ListAccounts(
	ctx context.Context,
	booksID int64,
	p page.Request[AccountKey],
) ([]domain.Account, *AccountKey, error) {
	return s.repo.ListAccounts(ctx, booksID, p)
}

// ReopenAccount reopens the account and its closed ancestors, so an open account never has a
// closed parent (A74).
func (s *Service) ReopenAccount(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Account, error) {
	var reopened domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		if a.SystemRole != "" {
			return ErrSystemAccount
		}

		if a.ClosedOn == nil {
			return &domain.FieldError{
				Field:   "id",
				Message: "account is open",
				Err:     domain.ErrValidation,
			}
		}

		reopened, err = reopenChain(ctx, r, booksID, id, a)

		return err
	})

	return reopened, err
}

func (s *Service) checkParent(ctx context.Context, r Repository, a domain.Account) error {
	if a.ParentID == uuid.Nil {
		return nil
	}

	parent, err := r.Account(ctx, a.BooksID, a.ParentID)
	if errors.Is(err, ErrNotFound) {
		return &domain.FieldError{
			Field:   "parent_id",
			Message: "unknown account",
			Err:     domain.ErrUnknownAccount,
		}
	}

	if err != nil {
		return err
	}

	if parent.IsBalance() {
		if err := checkParentEmpty(ctx, r, a, parent); err != nil {
			return err
		}
	}

	if a.ClosedOn == nil && parent.ClosedOn != nil {
		return &domain.FieldError{
			Field:   "parent_id",
			Message: "must be open",
			Err:     domain.ErrValidation,
		}
	}

	if a.ID != uuid.Nil {
		if err := checkNotDescendant(ctx, r, a, parent); err != nil {
			return err
		}
	}

	return domain.ValidateParent(a, parent)
}

// subtreeOf returns root followed by its descendants, parents before children.
func subtreeOf(root domain.Account, all []domain.Account) []domain.Account {
	children := map[uuid.UUID][]domain.Account{}
	for _, a := range all {
		if a.ParentID != uuid.Nil {
			children[a.ParentID] = append(children[a.ParentID], a)
		}
	}

	out := []domain.Account{root}
	for i := 0; i < len(out); i++ {
		out = append(out, children[out[i].ID]...)
	}

	return out
}

func reopenChain(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	a domain.Account,
) (domain.Account, error) {
	var reopened domain.Account

	for {
		a.ClosedOn = nil

		updated, err := r.UpdateAccount(ctx, a)
		if err != nil {
			return reopened, err
		}

		if updated.ID == id {
			reopened = updated
		}

		if err := r.Publish(
			ctx,
			outbox.Event{
				Type:        EventAccountReopened,
				BooksID:     booksID,
				AggregateID: a.ID.String(),
				Payload:     accountEvent{a.ID},
			},
		); err != nil {
			return reopened, err
		}

		if a.ParentID == uuid.Nil {
			return reopened, nil
		}

		if a, err = r.Account(ctx, booksID, a.ParentID); err != nil {
			return reopened, err
		}

		if a.ClosedOn == nil {
			return reopened, nil
		}
	}
}

func checkParentEmpty(
	ctx context.Context,
	r Repository,
	a domain.Account,
	parent domain.Account,
) error {
	totals, err := r.AccountTotals(ctx, a.BooksID, parent.ID)
	if err != nil {
		return err
	}

	if totals.Total != 0 || totals.LastBookedOn.After(earliestDate) {
		return &domain.FieldError{
			Field:   "parent_id",
			Message: "a balance account with postings cannot become a parent",
			Err:     domain.ErrValidation,
		}
	}

	return nil
}

func checkNotDescendant(
	ctx context.Context,
	r Repository,
	a domain.Account,
	parent domain.Account,
) error {
	var err error

	for ancestor := parent; ancestor.ParentID != uuid.Nil; {
		if ancestor.ParentID == a.ID {
			return &domain.FieldError{
				Field:   "parent_id",
				Message: "must not be a descendant of the account",
				Err:     domain.ErrValidation,
			}
		}

		if ancestor, err = r.Account(ctx, a.BooksID, ancestor.ParentID); err != nil {
			return err
		}
	}

	return nil
}
