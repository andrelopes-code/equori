package httpapi

import (
	"context"
	"errors"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

const chatUseID = "assistant.chat"

func (s *Server) GetAssistantChat(ctx context.Context, _ GetAssistantChatRequestObject) (GetAssistantChatResponseObject, error) {
	use, ok := s.svc.UseByID(chatUseID)
	if !ok {
		return nil, errors.New("use assistant.chat is not declared")
	}
	st, err := s.svc.ChatState(ctx, auth.MustUserID(ctx), use)
	if err != nil {
		return nil, err
	}
	out := AssistantChat{Available: st.Available}
	if st.ProviderName != "" {
		out.ProviderName, out.Model, out.Notice = &st.ProviderName, &st.Model, &st.Notice
	}
	if !st.RetryAt.IsZero() {
		out.RetryAt = &st.RetryAt
	}
	return GetAssistantChat200JSONResponse(out), nil
}
