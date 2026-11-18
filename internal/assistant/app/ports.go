// Package app holds the use cases of the assistant module: providers, chains and their
// resolution (ADR 019).
package app

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var (
	ErrSecretKeyMissing     = errors.New("EQUORI_SECRET_KEY is not set")
	ErrProviderUnauthorized = errors.New("the provider rejected the key")
	ErrProviderUnavailable  = errors.New("the provider did not answer")
)

type Repository interface {
	InsertProvider(ctx context.Context, p domain.Provider) error
	Provider(ctx context.Context, booksID int64, id uuid.UUID) (domain.Provider, error)
	Providers(ctx context.Context, booksID int64) ([]domain.Provider, error)
	UpdateProvider(ctx context.Context, p domain.Provider) error
	DeleteProvider(ctx context.Context, booksID int64, id uuid.UUID) error
	Chains(ctx context.Context, booksID int64) (map[string][]domain.ChainTarget, error)
	ReplaceChain(
		ctx context.Context,
		booksID int64,
		useID string,
		targets []domain.ChainTarget,
	) error
	ResealKeys(
		ctx context.Context,
		reseal func(booksID int64, id uuid.UUID, sealed []byte) ([]byte, error),
	) (int, error)
	UsageRepository
	ConversationRepository
	FileRepository
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
	CreateConversation(ctx context.Context, booksID, memberID int64, c domain.Conversation) error
	Conversation(
		ctx context.Context,
		booksID, memberID int64,
		id uuid.UUID,
	) (domain.Conversation, error)
	Conversations(
		ctx context.Context,
		booksID, memberID int64,
		after *ConversationKey,
		limit int,
	) ([]domain.Conversation, error)
	DeleteConversation(ctx context.Context, booksID, memberID int64, id uuid.UUID) error
	DeleteConversations(ctx context.Context, booksID, memberID int64) error
	AppendMessage(ctx context.Context, booksID int64, m domain.Message) (domain.Message, error)
	Messages(ctx context.Context, booksID int64, conversationID uuid.UUID) ([]domain.Message, error)

	InsertProposal(ctx context.Context, booksID int64, p domain.Proposal) error
	Proposal(ctx context.Context, booksID, memberID int64, id uuid.UUID) (domain.Proposal, error)
	Proposals(
		ctx context.Context,
		booksID int64,
		conversationID uuid.UUID,
	) ([]domain.Proposal, error)
	ClaimProposal(
		ctx context.Context,
		booksID, memberID int64,
		id uuid.UUID,
		now time.Time,
	) (domain.Proposal, bool, error)
	DecideProposal(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		status domain.ProposalStatus,
		result []byte,
		at time.Time,
	) error
	RejectProposal(
		ctx context.Context,
		booksID, memberID int64,
		id uuid.UUID,
		now time.Time,
	) (bool, error)
	AttachProposals(ctx context.Context, booksID int64, messageID uuid.UUID, ids []uuid.UUID) error
	DiscardProposals(ctx context.Context, booksID int64, ids []uuid.UUID, at time.Time) error
	// PromoteProposal moves a waiting proposal to pending with the arguments, preview, basis and expiry of p.
	PromoteProposal(ctx context.Context, booksID int64, p domain.Proposal) (bool, error)
}

// Tools is the chat's tool set: what a proposal previews, executes and classifies.
type Tools interface {
	Preview(
		ctx context.Context,
		name string,
		args json.RawMessage,
	) (tool.Preview, tool.Result, error)
	Call(ctx context.Context, name string, args json.RawMessage) (tool.Result, error)
	Validate(name string, args json.RawMessage) (tool.Result, error)
	Effect(name string) (tool.Effect, bool)
}

// Agent runs the model loop over the chat tools. Its errors are *LimitError, ErrChatUnavailable, ErrTurnFailed
// or a context error. Write tools reach Service.Propose with ctx. onText receives the model's text as it arrives.
type Agent interface {
	Run(
		ctx context.Context,
		booksID int64,
		req AgentRequest,
		onStep func(tool string),
		onText func(text string),
		onRestart func(),
	) (AgentResult, error)
}

// TurnEvents receives the progress of a turn. Turn is called once the user message is stored; after it the turn
// ends with Answer or Error. The text a Delta brought before a Step belongs to a call that asked for tools.
type TurnEvents interface {
	Turn(conversationID, messageID uuid.UUID)
	Delta(text string)
	Step(tool string)
	Answer(m AnsweredMessage)
	Error(err error)
}

// UsageRepository holds the day counters and the declared limits (ADR 019 U2, U4).
type UsageRepository interface {
	AddUsage(ctx context.Context, e domain.UsageEntry) error
	UsageSince(
		ctx context.Context,
		booksID int64,
		today, since time.Time,
	) ([]domain.UsageSummary, error)
	UsageByDay(ctx context.Context, booksID int64, from, to time.Time) ([]domain.UsageDay, error)
	Limits(ctx context.Context, booksID int64) ([]domain.Limit, error)
	SetLimit(ctx context.Context, booksID int64, l domain.Limit) error
}

// FileRepository stores the files a member attaches to a message (assistant parity design, F1).
type FileRepository interface {
	StoreFile(
		ctx context.Context,
		booksID, memberID int64,
		f domain.File,
		content []byte,
		staleBefore time.Time,
		limit int64,
	) (domain.File, error)
	DeleteUnsentFile(ctx context.Context, booksID, memberID int64, id uuid.UUID) error
	FileContent(
		ctx context.Context,
		booksID, memberID int64,
		id uuid.UUID,
	) (string, domain.FileKind, []byte, error)
	UnsentFiles(
		ctx context.Context,
		booksID, memberID int64,
		ids []uuid.UUID,
	) ([]domain.File, error)
	ConversationFiles(
		ctx context.Context,
		booksID int64,
		conversationID uuid.UUID,
	) ([]domain.File, error)
	// AppendUserMessage appends m and binds the files to it; ErrFileNotFound when one is not an
	// unsent file of the member.
	AppendUserMessage(
		ctx context.Context,
		booksID, memberID int64,
		m domain.Message,
		fileIDs []uuid.UUID,
	) (domain.Message, error)
}
