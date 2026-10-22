package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// CaptureAccount is a balance account with the names a capture line may use for it
// (capture A111), or a category a suggestion may name (ADR 014).
type CaptureAccount struct {
	ID, ParentID                  uuid.UUID
	Name, Class, Kind, SystemRole string
	Instrument                    money.Currency
	ClosedOn                      *time.Time
	// Institution is the institution's name, empty without one.
	Institution string
	// CardsLastFour holds the last four digits of the account's active cards.
	CardsLastFour []string
}

type CapturePayee struct {
	ID   uuid.UUID
	Name string
}

// CaptureVocabulary returns the balance accounts, the categories and the live payees of the user.
func (s *Service) CaptureVocabulary(ctx context.Context, userID int64) ([]CaptureAccount, []CapturePayee, error) {
	accounts, err := s.repo.AllAccounts(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	institutions, err := s.institutionNames(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	var out []CaptureAccount
	for _, a := range accounts {
		if a.Class == domain.ClassEquity {
			continue
		}
		c := CaptureAccount{
			ID: a.ID, ParentID: a.ParentID, Name: a.Name, Class: string(a.Class), Kind: string(a.Kind),
			SystemRole: string(a.SystemRole), Instrument: a.Instrument, ClosedOn: a.ClosedOn, Institution: institutions[a.InstitutionID],
		}
		if a.Kind == domain.KindCreditCard {
			cards, err := s.repo.Cards(ctx, userID, a.ID)
			if err != nil {
				return nil, nil, err
			}
			for _, card := range cards {
				if card.Active {
					c.CardsLastFour = append(c.CardsLastFour, card.LastFour)
				}
			}
		}
		out = append(out, c)
	}
	payees, err := s.allPayees(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	return out, payees, nil
}

func (s *Service) institutionNames(ctx context.Context, userID int64) (map[uuid.UUID]string, error) {
	names := map[uuid.UUID]string{}
	req := page.Request[InstitutionKey]{Limit: page.MaxLimit}
	for {
		items, next, err := s.repo.ListInstitutions(ctx, userID, req)
		if err != nil {
			return nil, err
		}
		for _, i := range items {
			names[i.ID] = i.Name
		}
		if next == nil {
			return names, nil
		}
		req.After = next
	}
}

func (s *Service) allPayees(ctx context.Context, userID int64) ([]CapturePayee, error) {
	var out []CapturePayee
	req := page.Request[PayeeKey]{Limit: page.MaxLimit}
	for {
		items, next, err := s.repo.ListPayees(ctx, userID, req)
		if err != nil {
			return nil, err
		}
		for _, p := range items {
			out = append(out, CapturePayee{ID: p.ID, Name: p.Name})
		}
		if next == nil {
			return out, nil
		}
		req.After = next
	}
}
