package app

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var refPattern = regexp.MustCompile(`^[0-9a-f-]{36}(#/[a-z0-9_/]+)?$`)

func validateMeta(meta ProposalMeta) error {
	if meta.Suggested && strings.TrimSpace(meta.Reason) == "" {
		return argumentFailure("proposal.reason", "is required when suggested is true")
	}

	if len(meta.Refs) > 0 && strings.TrimSpace(meta.Summary) == "" {
		return argumentFailure("proposal.summary", "is required when refs is set")
	}

	return nil
}

// refParents returns the proposals that refs names. Each must be pending, waiting or executed in the
// conversation, and each key must be a field of args.
func (s *Service) refParents(ctx context.Context, booksID int64, conversationID uuid.UUID, args []byte, refs map[string]string) (map[uuid.UUID]domain.Proposal, error) {
	stored, err := s.repo.Proposals(ctx, booksID, conversationID)
	if err != nil {
		return nil, err
	}

	parents := map[uuid.UUID]domain.Proposal{}

	for key, value := range refs {
		if !hasPointer(args, key) {
			return nil, argumentFailure("proposal.refs", key+" is not a field of the arguments")
		}

		id, err := uuid.Parse(strings.SplitN(value, "#", 2)[0])
		index := slices.IndexFunc(stored, func(p domain.Proposal) bool { return p.ID == id })

		if !refPattern.MatchString(value) || err != nil || index < 0 || !refusable(stored[index].Status) {
			return nil, argumentFailure("proposal.refs", key+" must reference a pending, waiting or executed proposal of this conversation")
		}

		parents[id] = stored[index]
	}

	return parents, nil
}

func refusable(status domain.ProposalStatus) bool {
	return status == domain.ProposalPending || status == domain.ProposalWaiting || status == domain.ProposalExecuted
}

func resultPointer(ref string) string {
	if _, pointer, found := strings.Cut(ref, "#"); found {
		return pointer
	}

	return "/id"
}

// promote moves each waiting proposal of the conversation whose parents are all executed to pending, or
// to failed when its references or its preview fail (spec 2026-11-03 §5.1).
func (s *Service) promote(ctx context.Context, booksID int64, conversationID uuid.UUID) error {
	stored, err := s.repo.Proposals(ctx, booksID, conversationID)
	if err != nil {
		return err
	}

	results := map[uuid.UUID][]byte{}

	for _, p := range stored {
		if p.Status == domain.ProposalExecuted {
			results[p.ID] = p.Result
		}
	}

	now := s.now()

	for _, p := range stored {
		parents := p.WaitingFor()
		executed := func(id uuid.UUID) bool { _, ok := results[id]; return ok }

		if p.Status != domain.ProposalWaiting || p.Expired(now) || len(parents) == 0 ||
			slices.ContainsFunc(parents, func(id uuid.UUID) bool { return !executed(id) }) {
			continue
		}

		if err := s.promoteOne(ctx, booksID, p, results); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) promoteOne(ctx context.Context, booksID int64, p domain.Proposal, results map[uuid.UUID][]byte) error {
	args, missing, err := resolveRefs(p.Arguments, p.Refs, results)
	if err != nil {
		return err
	}

	if missing != "" {
		content, err := json.Marshal(map[string]string{"error": "reference_unresolved", "field": missing})
		if err != nil {
			return err
		}

		return s.fail(ctx, booksID, p, content)
	}

	pv, res, err := s.tools.Preview(auth.WithBooksID(ctx, booksID), p.Tool, args)
	if err != nil {
		return err
	}

	if res.IsError {
		return s.fail(ctx, booksID, p, res.Content)
	}

	preview, err := json.Marshal(pv)
	if err != nil {
		return fmt.Errorf("encode preview of %s: %w", p.Tool, err)
	}

	promoted := domain.Proposal{
		ID: p.ID, Arguments: args, Preview: preview, Basis: tool.PreviewDigest(pv), ExpiresAt: s.now().Add(domain.ProposalTTL),
	}
	if _, err := s.repo.PromoteProposal(ctx, booksID, promoted); err != nil {
		return err
	}

	s.logProposal(ctx, booksID, p.ID, p.Tool, "promoted")

	return nil
}

// fail stores a waiting proposal as failed and blocks its dependents.
func (s *Service) fail(ctx context.Context, booksID int64, p domain.Proposal, content []byte) error {
	if err := s.repo.DecideProposal(ctx, booksID, p.ID, domain.ProposalFailed, content, s.now()); err != nil {
		return err
	}

	s.logProposal(ctx, booksID, p.ID, p.Tool, "failed")

	return s.block(ctx, booksID, p.ConversationID, p.ID)
}

// block sets blocked on every waiting proposal that depends on id, transitively.
func (s *Service) block(ctx context.Context, booksID int64, conversationID, id uuid.UUID) error {
	stored, err := s.repo.Proposals(ctx, booksID, conversationID)
	if err != nil {
		return err
	}

	queue := []uuid.UUID{id}

	for len(queue) > 0 {
		parent := queue[0]
		queue = queue[1:]

		for _, p := range stored {
			if p.Status != domain.ProposalWaiting || !slices.Contains(p.WaitingFor(), parent) {
				continue
			}

			if err := s.repo.DecideProposal(ctx, booksID, p.ID, domain.ProposalBlocked, nil, s.now()); err != nil {
				return err
			}

			s.logProposal(ctx, booksID, p.ID, p.Tool, "blocked")

			queue = append(queue, p.ID)
		}
	}

	return nil
}

// argumentFailure is the tool error the model receives for an invalid argument.
func argumentFailure(field, message string) error {
	content, err := json.Marshal(tool.InvalidArgument(field, message))
	if err != nil {
		return err
	}

	return &ToolFailure{Content: content}
}
