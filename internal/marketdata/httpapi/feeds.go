package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listMarketDataFeeds(
	ctx context.Context, _ *http.Request, _ httpserver.None,
) (MarketDataFeedList, error) {
	fs, err := s.svc.Feeds(ctx)
	if err != nil {
		return MarketDataFeedList{}, err
	}

	items := make([]MarketDataFeed, len(fs))
	for i, f := range fs {
		items[i] = feedOf(f)
	}

	return MarketDataFeedList{Items: items}, nil
}

func (s *Server) setMarketDataFeed(
	ctx context.Context, r *http.Request, in SetMarketDataFeedJSONRequestBody,
) (MarketDataFeed, error) {
	accept := in.AcceptUnofficial != nil && *in.AcceptUnofficial

	f, err := s.svc.SetFeed(ctx, r.PathValue("id"), in.Enabled, accept)
	if err != nil {
		return MarketDataFeed{}, err
	}

	return feedOf(f), nil
}

// refreshMarketData is a custom handler: the success status is 202 with no body.
func (s *Server) refreshMarketData(w http.ResponseWriter, r *http.Request) {
	if err := s.svc.Refresh(r.Context()); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.WriteHeader(http.StatusAccepted)
}

func feedOf(f domain.Feed) MarketDataFeed {
	out := MarketDataFeed{
		Id:             f.ID,
		Kind:           MarketDataFeedKind(f.Kind),
		Enabled:        f.Enabled,
		Suggested:      f.Suggested,
		Stale:          f.Stale,
		Missing:        f.Missing,
		LastRun:        f.LastRun,
		Error:          f.Error,
		Official:       f.Official,
		Covers:         f.Covers,
		HistoryPending: f.HistoryPending,
		SymbolOverride: f.SymbolOverride,
		Current:        f.Current,
		CurrentAt:      f.CurrentAt,
		CurrentError:   f.CurrentError,
	}
	if f.Last != nil {
		out.Last = &openapi_types.Date{Time: *f.Last}
	}

	return out
}
