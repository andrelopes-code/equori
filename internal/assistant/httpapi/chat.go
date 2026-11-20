package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

const chatUseID = "assistant.chat"

func (s *Server) getAssistantChat(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (AssistantChat, error) {
	use, ok := s.svc.UseByID(chatUseID)
	if !ok {
		return AssistantChat{}, errors.New("use assistant.chat is not declared")
	}

	st, err := s.svc.ChatState(ctx, auth.MustBooksID(ctx), use)
	if err != nil {
		return AssistantChat{}, err
	}

	out := AssistantChat{Available: st.Available, Targets: []AssistantChatTarget{}}
	for _, t := range st.Targets {
		out.Targets = append(out.Targets, AssistantChatTarget{
			ProviderId:   t.ProviderID,
			ProviderName: t.ProviderName,
			Model:        t.Model,
			Notice:       t.Notice,
			ReadsFiles:   t.ReadsFiles,
		})
	}

	if st.ProviderName != "" {
		out.ProviderName, out.Model, out.Notice = &st.ProviderName, &st.Model, &st.Notice
		out.ReadsFiles = &st.ReadsFiles
	}

	if !st.RetryAt.IsZero() {
		out.RetryAt = &st.RetryAt
	}

	return out, nil
}
