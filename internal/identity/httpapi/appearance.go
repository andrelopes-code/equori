package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getMemberAppearance(ctx context.Context, _ *http.Request, _ httpserver.None) (Appearance, error) {
	doc, err := s.svc.Appearance(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return Appearance{}, err
	}

	var appearance Appearance
	if err := json.Unmarshal(doc, &appearance); err != nil {
		return Appearance{}, fmt.Errorf("decode stored appearance: %w", err)
	}

	return appearance, nil
}

func (s *Server) setMemberAppearance(
	ctx context.Context,
	_ *http.Request,
	in SetMemberAppearanceJSONRequestBody,
) (Appearance, error) {
	doc, err := json.Marshal(in)
	if err != nil {
		return Appearance{}, fmt.Errorf("encode appearance: %w", err)
	}

	if err := s.svc.SetAppearance(ctx, auth.MustMemberID(ctx), doc); err != nil {
		return Appearance{}, err
	}

	return in, nil
}
