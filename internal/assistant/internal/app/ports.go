// Package app holds the use cases of the assistant module: providers, chains and their
// resolution (ADR 019).
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

var (
	ErrSecretKeyMissing     = errors.New("EQUORI_SECRET_KEY is not set")
	ErrProviderUnauthorized = errors.New("the provider rejected the key")
	ErrProviderUnavailable  = errors.New("the provider did not answer")
)

type Repository interface {
	InsertProvider(ctx context.Context, p domain.Provider) error
	Provider(ctx context.Context, userID int64, id uuid.UUID) (domain.Provider, error)
	Providers(ctx context.Context, userID int64) ([]domain.Provider, error)
	UpdateProvider(ctx context.Context, p domain.Provider) error
	DeleteProvider(ctx context.Context, userID int64, id uuid.UUID) error
	Chains(ctx context.Context, userID int64) (map[string][]domain.ChainTarget, error)
	ReplaceChain(ctx context.Context, userID int64, useID string, targets []domain.ChainTarget) error
	ResealKeys(ctx context.Context, reseal func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error)
	UsageRepository
	ConversationRepository
}

// Sealer seals values bound to their row (ADR 008).
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

// ModelLister asks a provider's API for its models. Errors wrap ErrProviderUnauthorized or
// ErrProviderUnavailable.
type ModelLister interface {
	Models(ctx context.Context, api domain.API, baseURL, key string) ([]string, error)
}

// ConversationKey is the position after which the next page of conversations starts.
type ConversationKey struct {
	UpdatedAt time.Time
	ID        uuid.UUID
}

// ConversationRepository stores conversations, their messages and their proposals (ADR 020).
type ConversationRepository interface {
	CreateConversation(ctx context.Context, userID int64, c domain.Conversation) error
	Conversation(ctx context.Context, userID int64, id uuid.UUID) (domain.Conversation, error)
	Conversations(ctx context.Context, userID int64, after *ConversationKey, limit int) ([]domain.Conversation, error)
	DeleteConversation(ctx context.Context, userID int64, id uuid.UUID) error
	DeleteConversations(ctx context.Context, userID int64) error
	AppendMessage(ctx context.Context, userID int64, m domain.Message) (domain.Message, error)
	Messages(ctx context.Context, userID int64, conversationID uuid.UUID) ([]domain.Message, error)

	InsertProposal(ctx context.Context, userID int64, p domain.Proposal) error
	Proposal(ctx context.Context, userID int64, id uuid.UUID) (domain.Proposal, error)
	Proposals(ctx context.Context, userID int64, conversationID uuid.UUID) ([]domain.Proposal, error)
	ClaimProposal(ctx context.Context, userID int64, id uuid.UUID, now time.Time) (domain.Proposal, bool, error)
	DecideProposal(ctx context.Context, userID int64, id uuid.UUID, status domain.ProposalStatus, result []byte, at time.Time) error
	RejectProposal(ctx context.Context, userID int64, id uuid.UUID, now time.Time) (bool, error)
	AttachProposals(ctx context.Context, userID int64, messageID uuid.UUID, ids []uuid.UUID) error
	DiscardProposals(ctx context.Context, userID int64, ids []uuid.UUID, at time.Time) error
}
