package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func toProposal(row AssistantProposal) domain.Proposal {
	p := domain.Proposal{
		ID: row.ID, ConversationID: row.ConversationID, Tool: row.Tool, Arguments: row.Arguments, Preview: row.Preview,
		Result: row.Result, Basis: row.Basis, Status: domain.ProposalStatus(row.Status), CreatedAt: row.CreatedAt,
		ExpiresAt: row.ExpiresAt,
	}
	if row.MessageID.Valid {
		p.MessageID = row.MessageID.UUID
	}
	if row.DecidedAt != nil {
		p.DecidedAt = *row.DecidedAt
	}
	return p
}

func (r *Repository) InsertProposal(ctx context.Context, userID int64, p domain.Proposal) error {
	return r.q.InsertProposal(ctx, InsertProposalParams{
		ID: p.ID, UserID: userID, ConversationID: p.ConversationID,
		MessageID: uuid.NullUUID{UUID: p.MessageID, Valid: p.MessageID != uuid.Nil},
		Tool:      p.Tool, Arguments: p.Arguments, Preview: p.Preview, Basis: p.Basis, Status: string(p.Status),
		Result: p.Result, CreatedAt: p.CreatedAt, ExpiresAt: p.ExpiresAt, DecidedAt: utc(&p.DecidedAt),
	})
}

func (r *Repository) Proposal(ctx context.Context, userID int64, id uuid.UUID) (domain.Proposal, error) {
	row, err := r.q.ProposalByID(ctx, ProposalByIDParams{UserID: userID, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Proposal{}, domain.ErrProposalNotFound
	}
	return toProposal(row), err
}

func (r *Repository) Proposals(ctx context.Context, userID int64, conversationID uuid.UUID) ([]domain.Proposal, error) {
	rows, err := r.q.ListProposals(ctx, ListProposalsParams{UserID: userID, ConversationID: conversationID})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Proposal, len(rows))
	for i, row := range rows {
		out[i] = toProposal(row)
	}
	return out, nil
}

func (r *Repository) ClaimProposal(ctx context.Context, userID int64, id uuid.UUID, now time.Time) (domain.Proposal, bool, error) {
	row, err := r.q.ClaimProposal(ctx, ClaimProposalParams{UserID: userID, ID: id, Now: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Proposal{}, false, nil
	}
	return toProposal(row), err == nil, err
}

func (r *Repository) DecideProposal(ctx context.Context, userID int64, id uuid.UUID, status domain.ProposalStatus, result []byte, at time.Time) error {
	return r.q.DecideProposal(ctx, DecideProposalParams{Status: string(status), Result: result, DecidedAt: &at, UserID: userID, ID: id})
}

func (r *Repository) RejectProposal(ctx context.Context, userID int64, id uuid.UUID, now time.Time) (bool, error) {
	n, err := r.q.RejectProposal(ctx, RejectProposalParams{Now: &now, UserID: userID, ID: id})
	return n > 0, err
}

func (r *Repository) AttachProposals(ctx context.Context, userID int64, messageID uuid.UUID, ids []uuid.UUID) error {
	return r.q.AttachProposals(ctx, AttachProposalsParams{
		MessageID: uuid.NullUUID{UUID: messageID, Valid: true}, UserID: userID, Ids: ids,
	})
}

func (r *Repository) DiscardProposals(ctx context.Context, userID int64, ids []uuid.UUID, at time.Time) error {
	return r.q.DiscardProposals(ctx, DiscardProposalsParams{At: &at, UserID: userID, Ids: ids})
}
