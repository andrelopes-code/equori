package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

// sendAssistantMessage runs the turn while it writes the event stream; an error before the first event
// answers a problem.
func (s *Server) sendAssistantMessage(w http.ResponseWriter, r *http.Request) {
	var body SendAssistantMessageJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

		return
	}

	ctx := r.Context()
	booksID, memberID := auth.MustBooksID(ctx), auth.MustMemberID(ctx)

	in := app.TurnInput{Text: body.Text}
	if body.FileIds != nil {
		in.FileIDs = *body.FileIds
	}

	if body.ConversationId != nil {
		in.ConversationID = *body.ConversationId
	}

	if body.Page != nil {
		in.Page = *body.Page
	}

	st := &eventStream{s: s, ctx: ctx, w: w, rc: http.NewResponseController(w)}
	if err := s.svc.Turn(ctx, booksID, memberID, in, st); err != nil {
		s.writeProblem(ctx, w, err)
	}
}

func (s *Server) problemOf(ctx context.Context, err error) problem.Details {
	d, ok := toProblem(err)
	if !ok {
		d = problem.New(http.StatusInternalServerError, "internal_error", "")

		s.log.ErrorContext(ctx, "request failed", "error", err)
	}

	d.RequestID = httpserver.RequestID(ctx)

	return d
}

func (s *Server) writeProblem(ctx context.Context, w http.ResponseWriter, err error) {
	problem.Write(w, s.problemOf(ctx, err))
}

// eventStream writes the events of a turn; the first event starts the stream (spec 6.1).
type eventStream struct {
	s       *Server
	ctx     context.Context
	w       http.ResponseWriter
	rc      *http.ResponseController
	started bool
}

func (e *eventStream) send(name string, data any) {
	if !e.started {
		e.started = true
		// A stream outlives the server's usual write deadline (audit item 9).
		_ = e.rc.SetWriteDeadline(time.Now().Add(app.WriteDeadline))
		e.w.Header().Set("Content-Type", "text/event-stream")
		e.w.Header().Set("Cache-Control", "no-store")
		e.w.WriteHeader(http.StatusOK)
	}

	b, err := json.Marshal(data)
	if err != nil {
		e.s.log.ErrorContext(e.ctx, "assistant event not encoded", "event", name, "error", err)
		return
	}

	if _, err := fmt.Fprintf(e.w, "event: %s\ndata: %s\n\n", name, b); err == nil {
		_ = e.rc.Flush()
	}
}

func (e *eventStream) Turn(conversationID, messageID uuid.UUID) {
	e.send("turn", map[string]uuid.UUID{"conversation_id": conversationID, "message_id": messageID})
}

func (e *eventStream) Delta(text string) { e.send("delta", map[string]string{"text": text}) }

func (e *eventStream) Step(tool string) { e.send("step", map[string]string{"tool": tool}) }

func (e *eventStream) Answer(m app.AnsweredMessage) {
	out, err := e.s.toMessage(m.Message, m.Proposals)
	if err != nil {
		e.Error(err)
		return
	}

	e.send("answer", out)
}

func (e *eventStream) Error(err error) { e.send("error", e.s.problemOf(e.ctx, err)) }
