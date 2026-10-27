package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	MaxSteps       = 6
	TurnTimeout    = 90 * time.Second
	WriteDeadline  = 120 * time.Second
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

// AgentRequest is what the agent sends to the model: the prompt, the earlier turns and the user's text.
type AgentRequest struct {
	System  string
	History []HistoryMessage
	Text    string
}

// AgentResult is the final answer of an agent run and what the run cost.
type AgentResult struct {
	Text                      string
	StepLimit, Restarted      bool
	Steps, ToolCalls          int
	InputTokens, OutputTokens int
	ProviderName, Model       string
}

// Agent runs the model loop over the chat tools. Its errors are *LimitError, ErrChatUnavailable, ErrTurnFailed
// or a context error. Write tools reach Service.Propose with ctx.
type Agent interface {
	Run(ctx context.Context, userID int64, req AgentRequest, onStep func(tool string), onRestart func()) (AgentResult, error)
}

// UseAgent sets the agent and the profile lookup the chat needs; the chat does not run without them.
func (s *Service) UseAgent(a Agent, profile func(context.Context, int64) (locale.Locale, error)) {
	s.agent, s.profile = a, profile
}

type AnsweredMessage struct {
	Message   domain.Message
	Proposals []domain.Proposal
}

// TurnEvents receives the progress of a turn. Turn is called once the user message is stored; after it the turn
// ends with Answer or Error.
type TurnEvents interface {
	Turn(conversationID, messageID uuid.UUID)
	Step(tool string)
	Answer(m AnsweredMessage)
	Error(err error)
}

type TurnInput struct {
	ConversationID uuid.UUID // Nil starts a conversation
	Text, Page     string
}

type turnKey struct{}

// turnState collects the proposals a turn creates and names its conversation for the write handlers.
type turnState struct {
	conversationID uuid.UUID
	mu             sync.Mutex
	proposals      []uuid.UUID
}

func (t *turnState) add(id uuid.UUID) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.proposals = append(t.proposals, id)
}

func (t *turnState) take() []uuid.UUID {
	t.mu.Lock()
	defer t.mu.Unlock()
	ids := t.proposals
	t.proposals = nil
	return ids
}

// TurnConversation returns the conversation of the turn that owns ctx.
func TurnConversation(ctx context.Context) uuid.UUID {
	if t, ok := ctx.Value(turnKey{}).(*turnState); ok {
		return t.conversationID
	}
	return uuid.Nil
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// Turn runs one user message through the model and reports through ev (spec 6). An error returned before ev.Turn
// has been called leaves the stream unstarted; after it, failures reach ev.Error.
func (s *Service) Turn(ctx context.Context, userID int64, in TurnInput, ev TurnEvents) error {
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
		if _, err = s.repo.Conversation(ctx, userID, in.ConversationID); err != nil {
			return err
		}
		if messages, err = s.repo.Messages(ctx, userID, in.ConversationID); err != nil {
			return err
		}
		if proposals, err = s.repo.Proposals(ctx, userID, in.ConversationID); err != nil {
			return err
		}
	}
	use, ok := s.use(chatUseID)
	if !ok {
		return errors.New("use assistant.chat is not declared")
	}
	st, err := s.ChatState(ctx, userID, use)
	if err != nil {
		return err
	}
	if !st.Available {
		if !st.RetryAt.IsZero() {
			s.logTurn(ctx, userID, in.ConversationID, outcomeExhaust, AgentResult{}, now)
			return &LimitError{RetryAt: st.RetryAt}
		}
		s.logTurn(ctx, userID, in.ConversationID, outcomeUnavail, AgentResult{}, now)
		return ErrChatUnavailable
	}
	prof, err := s.profile(ctx, userID)
	if err != nil {
		return fmt.Errorf("read profile: %w", err)
	}
	if in.ConversationID == uuid.Nil {
		conv.ID = uuid.New()
		if err := s.repo.CreateConversation(ctx, userID, conv); err != nil {
			return err
		}
	}
	userMsg, err := s.repo.AppendMessage(ctx, userID, domain.Message{ID: uuid.New(), ConversationID: conv.ID, Role: domain.RoleUser, Content: text, CreatedAt: now})
	if err != nil {
		return err
	}
	ev.Turn(conv.ID, userMsg.ID)

	state := &turnState{conversationID: conv.ID}
	runCtx, cancel := context.WithTimeout(context.WithValue(ctx, turnKey{}, state), TurnTimeout)
	defer cancel()
	req := AgentRequest{
		System:  Prompt(PromptInput{Today: s.today(), Locale: prof, Page: in.Page}),
		History: History(messages, proposals, now),
		Text:    text,
	}
	discard := func() {
		if ids := state.take(); len(ids) > 0 {
			// The caller's context may be done; the discard must still reach the database.
			if err := s.repo.DiscardProposals(context.WithoutCancel(ctx), userID, ids, s.now()); err != nil {
				s.log.WarnContext(ctx, "assistant proposals not discarded", "error", err)
			}
		}
	}
	res, err := s.agent.Run(runCtx, userID, req, ev.Step, discard)
	if err != nil {
		discard()
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
		s.logTurn(ctx, userID, conv.ID, outcome, res, now)
		stored := domain.OutcomeFailed
		if outcome == outcomeCancel {
			stored = domain.OutcomeCanceled
		}
		// The message records that the user's text got no answer; the client may already be gone.
		if _, err := s.repo.AppendMessage(context.WithoutCancel(ctx), userID, domain.Message{
			ID: uuid.New(), ConversationID: conv.ID, Role: domain.RoleAssistant, Outcome: stored, CreatedAt: s.now(),
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
	outcome := domain.OutcomeAnswered
	if res.StepLimit {
		outcome = domain.OutcomeStepLimit
	}
	// The answer is stored even when the client left after the model returned: nothing else reads the turn.
	storeCtx := context.WithoutCancel(ctx)
	answer, err := s.repo.AppendMessage(storeCtx, userID, domain.Message{
		ID: uuid.New(), ConversationID: conv.ID, Role: domain.RoleAssistant, Outcome: outcome,
		Content: truncateRunes(strings.TrimSpace(res.Text), domain.MaxAnswer), CreatedAt: s.now(),
	})
	if err != nil {
		discard()
		return s.failAfterStream(ctx, ev, err)
	}
	ids := state.take()
	out := AnsweredMessage{Message: answer}
	if len(ids) > 0 {
		if err := s.repo.AttachProposals(storeCtx, userID, answer.ID, ids); err != nil {
			return s.failAfterStream(ctx, ev, err)
		}
		for _, id := range ids {
			p, err := s.repo.Proposal(storeCtx, userID, id)
			if err != nil {
				return s.failAfterStream(ctx, ev, err)
			}
			out.Proposals = append(out.Proposals, p)
		}
	}
	s.logTurn(ctx, userID, conv.ID, string(outcome), res, now)
	ev.Answer(out)
	return nil
}

func (s *Service) failAfterStream(ctx context.Context, ev TurnEvents, err error) error {
	s.log.ErrorContext(ctx, "assistant turn storage failed", "error", err)
	ev.Error(fmt.Errorf("%w: %w", ErrTurnFailed, err))
	return nil
}

func (s *Service) logTurn(ctx context.Context, userID int64, conversationID uuid.UUID, outcome string, r AgentResult, began time.Time) {
	s.log.InfoContext(ctx, "assistant turn", "user_id", userID, "conversation_id", conversationID, "steps", r.Steps,
		"tool_calls", r.ToolCalls, "input_tokens", r.InputTokens, "output_tokens", r.OutputTokens,
		"provider", r.ProviderName, "model", r.Model, "outcome", outcome, "restarted", r.Restarted, "duration", s.now().Sub(began))
}
