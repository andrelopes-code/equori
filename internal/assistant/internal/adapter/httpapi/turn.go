package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

// turnStream is the response of sendAssistantMessage: it runs the turn while it writes the event stream, so
// the strict handler's visitor gives it the response writer.
type turnStream struct {
	run func(w http.ResponseWriter) error
}

func (t turnStream) VisitSendAssistantMessageResponse(w http.ResponseWriter) error { return t.run(w) }

func (s *Server) SendAssistantMessage(ctx context.Context, req SendAssistantMessageRequestObject) (SendAssistantMessageResponseObject, error) {
	userID := auth.MustUserID(ctx)
	in := app.TurnInput{Text: req.Body.Text}
	if req.Body.ConversationId != nil {
		in.ConversationID = *req.Body.ConversationId
	}
	if req.Body.Page != nil {
		in.Page = *req.Body.Page
	}
	return turnStream{run: func(w http.ResponseWriter) error {
		st := &eventStream{s: s, ctx: ctx, w: w, rc: http.NewResponseController(w)}
		if err := s.svc.Turn(ctx, userID, in, st); err != nil {
			s.writeProblem(ctx, w, err)
		}
		return nil
	}}, nil
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
