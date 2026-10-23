package app

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

// UseView is a use with its effective chain for one user; Default reports that the chain
// comes from the use's declaration.
type UseView struct {
	Use     Use
	Default bool
	Targets []Target
}

type ChainInput struct {
	ProviderID   uuid.UUID
	Model        string
	Capabilities []string
}

// CapabilityError names the model of a chain target and the capabilities it lacks.
type CapabilityError struct {
	Model   string
	Missing []string
}

func (e *CapabilityError) Error() string {
	return fmt.Sprintf("model %s lacks %s", e.Model, strings.Join(e.Missing, ", "))
}

func (e *CapabilityError) Unwrap() error { return domain.ErrCapabilityMissing }

// Uses returns every declared use with its effective chain, keys left out.
func (s *Service) Uses(ctx context.Context, userID int64) ([]UseView, error) {
	chains, err := s.repo.Chains(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]UseView, 0, len(s.uses))
	for _, u := range s.uses {
		targets, err := s.Resolve(ctx, userID, true, u)
		if err != nil {
			return nil, err
		}
		for i := range targets {
			targets[i].Key = ""
		}
		out = append(out, UseView{Use: u, Default: len(chains[u.ID]) == 0, Targets: targets})
	}
	return out, nil
}

// SetChain stores the user's chain for a use; an empty list restores the default.
func (s *Service) SetChain(ctx context.Context, userID int64, useID string, in []ChainInput) error {
	use, ok := s.use(useID)
	if !ok {
		return domain.ErrUseNotFound
	}
	targets := make([]domain.ChainTarget, 0, len(in))
	for _, c := range in {
		t, err := domain.NewChainTarget(c.ProviderID, c.Model, c.Capabilities)
		if err != nil {
			return err
		}
		p, err := s.repo.Provider(ctx, userID, c.ProviderID)
		if err != nil {
			return err
		}
		if missing := domain.Missing(use.Needs, domain.ModelCapabilities(p.Preset, t.Model, t.Capabilities)); len(missing) > 0 {
			return &CapabilityError{Model: t.Model, Missing: missing}
		}
		targets = append(targets, t)
	}
	return s.repo.ReplaceChain(ctx, userID, useID, targets)
}
