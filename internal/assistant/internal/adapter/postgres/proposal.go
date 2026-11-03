package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func toProposal(row AssistantProposal) (domain.Proposal, error) {
	p := domain.Proposal{
		ID: row.ID, ConversationID: row.ConversationID, Tool: row.Tool, Arguments: row.Arguments, Preview: row.Preview,
		Result: row.Result, Basis: row.Basis, Status: domain.ProposalStatus(row.Status), CreatedAt: row.CreatedAt,
		ExpiresAt: row.ExpiresAt, Suggested: row.Suggested,
	}
	if row.Reason != nil {
		p.Reason = *row.Reason
	}

	if row.Summary != nil {
		p.Summary = *row.Summary
	}

	if row.Refs != nil {
		if err := json.Unmarshal(row.Refs, &p.Refs); err != nil {
			return domain.Proposal{}, fmt.Errorf("decode proposal refs: %w", err)
		}
	}

	if row.MessageID.Valid {
		p.MessageID = row.MessageID.UUID
	}

	if row.DecidedAt != nil {
		p.DecidedAt = *row.DecidedAt
	}

	return p, nil
}

func (r *Repository) InsertProposal(ctx context.Context, booksID int64, p domain.Proposal) error {
	var refs []byte

	if p.Refs != nil {
		var err error
		if refs, err = json.Marshal(p.Refs); err != nil {
			return fmt.Errorf("encode proposal refs: %w", err)
		}
	}

	return r.q.InsertProposal(ctx, InsertProposalParams{
		ID: p.ID, BooksID: booksID, ConversationID: p.ConversationID,
		MessageID: uuid.NullUUID{UUID: p.MessageID, Valid: p.MessageID != uuid.Nil},
		Tool:      p.Tool, Arguments: p.Arguments, Preview: p.Preview, Basis: p.Basis, Status: string(p.Status),
		Result: p.Result, CreatedAt: p.CreatedAt, ExpiresAt: p.ExpiresAt, DecidedAt: utc(&p.DecidedAt),
		Suggested: p.Suggested, Reason: nilIfEmpty(p.Reason), Summary: nilIfEmpty(p.Summary), Refs: refs,
	})
}

// PromoteProposal moves a waiting proposal to pending with the arguments, preview, basis and expiry of p.
func (r *Repository) PromoteProposal(ctx context.Context, booksID int64, p domain.Proposal) (bool, error) {
	n, err := r.q.PromoteProposal(ctx, PromoteProposalParams{
		Arguments: p.Arguments, Preview: p.Preview, Basis: p.Basis, ExpiresAt: p.ExpiresAt, BooksID: booksID, ID: p.ID,
	})

	return n > 0, err
}

func (r *Repository) Proposal(ctx context.Context, booksID, memberID int64, id uuid.UUID) (domain.Proposal, error) {
	row, err := r.q.ProposalByID(ctx, ProposalByIDParams{BooksID: booksID, MemberID: memberID, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Proposal{}, domain.ErrProposalNotFound
	}

	if err != nil {
		return domain.Proposal{}, err
	}

	return toProposal(row)
}

func (r *Repository) Proposals(ctx context.Context, booksID int64, conversationID uuid.UUID) ([]domain.Proposal, error) {
	rows, err := r.q.ListProposals(ctx, ListProposalsParams{BooksID: booksID, ConversationID: conversationID})
	if err != nil {
		return nil, err
	}

	out := make([]domain.Proposal, len(rows))
	for i, row := range rows {
		if out[i], err = toProposal(row); err != nil {
			return nil, err
		}
	}

	return out, nil
}

func (r *Repository) ClaimProposal(ctx context.Context, booksID, memberID int64, id uuid.UUID, now time.Time) (domain.Proposal, bool, error) {
	row, err := r.q.ClaimProposal(ctx, ClaimProposalParams{BooksID: booksID, MemberID: memberID, ID: id, Now: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Proposal{}, false, nil
	}

	if err != nil {
		return domain.Proposal{}, false, err
	}

	p, err := toProposal(row)

	return p, err == nil, err
}

func (r *Repository) DecideProposal(ctx context.Context, booksID int64, id uuid.UUID, status domain.ProposalStatus, result []byte, at time.Time) error {
	return r.q.DecideProposal(ctx, DecideProposalParams{Status: string(status), Result: result, DecidedAt: &at, BooksID: booksID, ID: id})
}

func (r *Repository) RejectProposal(ctx context.Context, booksID, memberID int64, id uuid.UUID, now time.Time) (bool, error) {
	n, err := r.q.RejectProposal(ctx, RejectProposalParams{Now: &now, BooksID: booksID, MemberID: memberID, ID: id})
	return n > 0, err
}

func (r *Repository) AttachProposals(ctx context.Context, booksID int64, messageID uuid.UUID, ids []uuid.UUID) error {
	return r.q.AttachProposals(ctx, AttachProposalsParams{
		MessageID: uuid.NullUUID{UUID: messageID, Valid: true}, BooksID: booksID, Ids: ids,
	})
}

func (r *Repository) DiscardProposals(ctx context.Context, booksID int64, ids []uuid.UUID, at time.Time) error {
	return r.q.DiscardProposals(ctx, DiscardProposalsParams{At: &at, BooksID: booksID, Ids: ids})
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}
