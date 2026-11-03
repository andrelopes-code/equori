package app

import (
	"context"
	"encoding/json"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Signal is evidence the model receives with a proposal (spec 2026-11-03 §7).
type Signal struct {
	Kind string          `json:"kind"`
	Data json.RawMessage `json:"data"`
}

// UseSignals sets the lookup of the signals of a preview; nil attaches none.
func (s *Service) UseSignals(f func(ctx context.Context, booksID int64, p tool.Preview) ([]Signal, error)) {
	s.signals = f
}

// proposalResult is what the model receives for a stored proposal. A pending proposal carries the
// signals of its preview; a failed lookup logs and leaves them out.
func (s *Service) proposalResult(ctx context.Context, booksID int64, p domain.Proposal) (json.RawMessage, error) {
	if p.Status == domain.ProposalWaiting {
		return json.Marshal(map[string]any{"proposal_id": p.ID, "status": "waiting_for_confirmation_of", "waiting_for": p.WaitingFor()})
	}

	out := map[string]any{"proposal_id": p.ID, "status": "awaiting_confirmation", "preview": json.RawMessage(p.Preview)}
	if signals := s.signalsOf(ctx, booksID, p); len(signals) > 0 {
		out["signals"] = signals
	}

	return json.Marshal(out)
}

func (s *Service) signalsOf(ctx context.Context, booksID int64, p domain.Proposal) []Signal {
	if s.signals == nil {
		return nil
	}

	var pv tool.Preview
	if err := json.Unmarshal(p.Preview, &pv); err != nil {
		s.log.WarnContext(ctx, "assistant signals not read", "proposal_id", p.ID, "error", err)
		return nil
	}

	signals, err := s.signals(ctx, booksID, pv)
	if err != nil {
		s.log.WarnContext(ctx, "assistant signals not read", "proposal_id", p.ID, "error", err)
		return nil
	}

	return signals
}
