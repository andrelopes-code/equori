package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getSentimentIndex(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (SentimentIndex, error) {
	x, err := s.svc.Sentiment(ctx, r.PathValue("id"))
	if err != nil {
		return SentimentIndex{}, err
	}

	out := SentimentIndex{Id: x.ID, Enabled: x.Enabled, Days: x.Days, Counts: x.Counts[:]}
	if x.Since != nil {
		out.Since = &openapi_types.Date{Time: *x.Since}
	}

	if x.Latest != nil {
		out.Value = &x.Latest.Value
		out.Date = &openapi_types.Date{Time: x.Latest.Date}
	}

	return out, nil
}
