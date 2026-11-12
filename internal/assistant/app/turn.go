package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	MaxSteps       = 12
	TurnTimeout    = 150 * time.Second
	WriteDeadline  = 180 * time.Second
	chatUseID      = "assistant.chat"
	outcomeFailed  = "failed"
	outcomeCancel  = "canceled"
	outcomeExhaust = "exhausted"
	outcomeUnavail = "unavailable"
)

var (
	ErrChatUnavailable = errors.New("no language model provider serves the assistant")
	ErrTurnFailed      = errors.New("the language model provider refused the request")
	ErrInvalidText     = errors.New("the message must have between 1 and 4000 characters")
)

// AgentRequest is what the agent sends to the model: the prompt, the earlier turns and the book's text.
// Deadline is the instant the turn ends, on the instance clock.
type AgentRequest struct {
	System   string
	History  []HistoryMessage
	Text     string
	Deadline time.Time
}

// AgentResult is the final answer of an agent run and what the run cost.
type AgentResult struct {
	Text                      string
	StepLimit, Restarted      bool
	Steps, ToolCalls          int
	InputTokens, OutputTokens int
	ProviderName, Model       string
}

// UseNotices sets the lookup of the accounts the system prompt names (A152).
func (s *Service) UseNotices(n func(context.Context, int64) ([]AccountNotice, error)) {
	s.notices = n
}

// UseAgent sets the agent and the profile lookup the chat needs; the chat does not run without them.
func (s *Service) UseAgent(a Agent, profile func(context.Context, int64) (locale.Locale, error)) {
	s.agent, s.profile = a, profile
}

type AnsweredMessage struct {
	Message   domain.Message
	Proposals []domain.Proposal
}

type TurnInput struct {
	ConversationID uuid.UUID // Nil starts a conversation
	Text, Page     string
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}

	return string([]rune(s)[:n])
}

// Turn runs one book message through the model and reports through ev (spec 6). An error returned before ev.Turn
// has been called leaves the stream unstarted; after it, failures reach ev.Error.
func (s *Service) Turn(ctx context.Context, booksID, memberID int64, in TurnInput, ev TurnEvents) error {
	text := strings.TrimSpace(in.Text)
	if n := utf8.RuneCountInString(text); n < 1 || n > domain.MaxMessage {
		return ErrInvalidText
	}

	now := s.now()
	conv := domain.Conversation{ID: in.ConversationID, Title: domain.Title(text), CreatedAt: now, UpdatedAt: now}
	var messages []domain.Message

	var proposals []domain.Proposal
	if in.ConversationID != uuid.Nil {
		var err error
		if messages, proposals, err = s.loadConversation(ctx, booksID, memberID, in.ConversationID); err != nil {
			return err
		}
	}

	if err := s.requireChat(ctx, booksID, in.ConversationID, now); err != nil {
		return err
	}

	prof, notices, err := s.promptInputs(ctx, booksID)
	if err != nil {
		return err
	}

	conv, userMsg, err := s.storeUserMessage(ctx, booksID, memberID, in, conv, text, now)
	if err != nil {
		return err
	}

	ev.Turn(conv.ID, userMsg.ID)

	state := &turnState{conversationID: conv.ID}
	book := s.bookReads(ctx, booksID)

	runCtx, cancel := context.WithTimeout(context.WithValue(ctx, turnKey{}, state), TurnTimeout)
	defer cancel()

	req := s.agentRequest(ctx, in, text, prof, notices, book, messages, proposals, now)
	discard := func() { s.discardProposals(ctx, booksID, state) }

	res, err := s.agent.Run(runCtx, booksID, req, ev.Step, ev.Delta, discard)
	if err != nil {
		return s.failTurn(ctx, ev, booksID, conv.ID, state, res, err, now)
	}

	return s.answerTurn(ctx, ev, booksID, memberID, conv.ID, state, res, now)
}

// storeUserMessage creates the conversation when the turn starts one and appends the book's text to it.
func (s *Service) storeUserMessage(
	ctx context.Context,
	booksID, memberID int64,
	in TurnInput,
	conv domain.Conversation,
	text string,
	now time.Time,
) (domain.Conversation, domain.Message, error) {
	if in.ConversationID == uuid.Nil {
		conv.ID = uuid.New()
		if err := s.repo.CreateConversation(ctx, booksID, memberID, conv); err != nil {
			return conv, domain.Message{}, err
		}
	}

	userMsg, err := s.repo.AppendMessage(ctx, booksID, domain.Message{
		ID: uuid.New(), ConversationID: conv.ID, Role: domain.RoleUser, Content: text, CreatedAt: now,
	})

	return conv, userMsg, err
}

// agentRequest builds the prompt, the history and the deadline of the turn.
func (s *Service) agentRequest(
	ctx context.Context,
	in TurnInput,
	text string,
	prof locale.Locale,
	notices []AccountNotice,
	book []BookRead,
	messages []domain.Message,
	proposals []domain.Proposal,
	now time.Time,
) AgentRequest {
	return AgentRequest{
		System: Prompt(PromptInput{
			Today:   clock.DateOf(s.now(), clock.Location(ctx)),
			Locale:  prof,
			Page:    in.Page,
			Notices: notices,
			Book:    book,
		}),
		History:  History(messages, proposals, now),
		Text:     text,
		Deadline: s.now().Add(TurnTimeout),
	}
}

// loadConversation checks the conversation belongs to the member and reads its messages and proposals.
func (s *Service) loadConversation(
	ctx context.Context,
	booksID, memberID int64,
	conversationID uuid.UUID,
) ([]domain.Message, []domain.Proposal, error) {
	if _, err := s.repo.Conversation(ctx, booksID, memberID, conversationID); err != nil {
		return nil, nil, err
	}

	messages, err := s.repo.Messages(ctx, booksID, conversationID)
	if err != nil {
		return nil, nil, err
	}

	proposals, err := s.repo.Proposals(ctx, booksID, conversationID)
	if err != nil {
		return nil, nil, err
	}

	return messages, proposals, nil
}

// requireChat returns an error, after logging the turn, when the chat is exhausted or unavailable.
func (s *Service) requireChat(
	ctx context.Context,
	booksID int64,
	conversationID uuid.UUID,
	now time.Time,
) error {
	use, ok := s.use(chatUseID)
	if !ok {
		return errors.New("use assistant.chat is not declared")
	}

	st, err := s.ChatState(ctx, booksID, use)
	if err != nil {
		return err
	}

	if !st.Available {
		if !st.RetryAt.IsZero() {
			s.logTurn(ctx, booksID, conversationID, outcomeExhaust, AgentResult{}, now)
			return &LimitError{RetryAt: st.RetryAt}
		}

		s.logTurn(ctx, booksID, conversationID, outcomeUnavail, AgentResult{}, now)

		return ErrChatUnavailable
	}

	return nil
}

// promptInputs reads the book's locale and the account notices the system prompt names.
func (s *Service) promptInputs(ctx context.Context, booksID int64) (locale.Locale, []AccountNotice, error) {
	prof, err := s.profile(ctx, booksID)
	if err != nil {
		return prof, nil, fmt.Errorf("read profile: %w", err)
	}

	var notices []AccountNotice
	if s.notices != nil {
		if notices, err = s.notices(ctx, booksID); err != nil {
			return prof, notices, fmt.Errorf("read account notices: %w", err)
		}
	}

	return prof, notices, nil
}

func (s *Service) discardProposals(ctx context.Context, booksID int64, state *turnState) {
	if ids := state.take(); len(ids) > 0 {
		// The caller's context may be done; the discard must still reach the database.
		if err := s.repo.DiscardProposals(context.WithoutCancel(ctx), booksID, ids, s.now()); err != nil {
			s.log.WarnContext(ctx, "assistant proposals not discarded", "error", err)
		}
	}
}

// failTurn discards the turn's proposals, logs the outcome and stores the unanswered message; a
// canceled turn reports nothing, any other reports err through ev.Error.
func (s *Service) failTurn(
	ctx context.Context,
	ev TurnEvents,
	booksID int64,
	conversationID uuid.UUID,
	state *turnState,
	res AgentResult,
	err error,
	now time.Time,
) error {
	s.discardProposals(ctx, booksID, state)

	outcome := outcomeFailed
	switch {
	case ctx.Err() != nil:
		outcome = outcomeCancel
	case errors.Is(err, ErrChatUnavailable):
		outcome = outcomeUnavail
	default:
		if _, ok := errors.AsType[*LimitError](err); ok {
			outcome = outcomeExhaust
		}
	}

	s.logTurn(ctx, booksID, conversationID, outcome, res, now)

	stored := domain.OutcomeFailed
	if outcome == outcomeCancel {
		stored = domain.OutcomeCanceled
	}

	// The message records that the book's text got no answer; the client may already be gone.
	if _, err := s.repo.AppendMessage(context.WithoutCancel(ctx), booksID, domain.Message{
		ID: uuid.New(), ConversationID: conversationID, Role: domain.RoleAssistant, Outcome: stored, CreatedAt: s.now(),
	}); err != nil {
		s.log.ErrorContext(ctx, "assistant unanswered turn not stored", "error", err)
	}

	if outcome == outcomeCancel {
		return nil
	}

	if outcome == outcomeFailed && !errors.Is(err, ErrTurnFailed) {
		err = fmt.Errorf("%w: %w", ErrTurnFailed, err)
	}

	ev.Error(err)

	return nil
}

// answerTurn stores the answer with its proposals, logs the turn and reports the answer through ev.
func (s *Service) answerTurn(
	ctx context.Context,
	ev TurnEvents,
	booksID, memberID int64,
	conversationID uuid.UUID,
	state *turnState,
	res AgentResult,
	now time.Time,
) error {
	outcome := domain.OutcomeAnswered
	if res.StepLimit {
		outcome = domain.OutcomeStepLimit
	}

	// The answer is stored even when the client left after the model returned: nothing else reads the turn.
	storeCtx := context.WithoutCancel(ctx)

	answer, err := s.repo.AppendMessage(storeCtx, booksID, domain.Message{
		ID: uuid.New(), ConversationID: conversationID, Role: domain.RoleAssistant, Outcome: outcome,
		Content: truncateRunes(strings.TrimSpace(res.Text), domain.MaxAnswer), CreatedAt: s.now(),
	})
	if err != nil {
		s.discardProposals(ctx, booksID, state)
		return s.failAfterStream(ctx, ev, err)
	}

	ids := state.take()

	out := AnsweredMessage{Message: answer}
	if len(ids) > 0 {
		if err := s.repo.AttachProposals(storeCtx, booksID, answer.ID, ids); err != nil {
			return s.failAfterStream(ctx, ev, err)
		}

		for _, id := range ids {
			p, err := s.repo.Proposal(storeCtx, booksID, memberID, id)
			if err != nil {
				return s.failAfterStream(ctx, ev, err)
			}

			out.Proposals = append(out.Proposals, p)
		}
	}

	s.logTurn(ctx, booksID, conversationID, string(outcome), res, now)
	ev.Answer(out)

	return nil
}

func (s *Service) failAfterStream(ctx context.Context, ev TurnEvents, err error) error {
	s.log.ErrorContext(ctx, "assistant turn storage failed", "error", err)
	ev.Error(fmt.Errorf("%w: %w", ErrTurnFailed, err))

	return nil
}

func (s *Service) logTurn(ctx context.Context, booksID int64, conversationID uuid.UUID, outcome string, r AgentResult, began time.Time) {
	s.log.InfoContext(ctx, "assistant turn", "books_id", booksID, "conversation_id", conversationID, "steps", r.Steps,
		"tool_calls", r.ToolCalls, "input_tokens", r.InputTokens, "output_tokens", r.OutputTokens,
		"provider", r.ProviderName, "model", r.Model, "outcome", outcome, "restarted", r.Restarted, "duration", s.now().Sub(began))
}
