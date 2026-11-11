package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
)

func (s *Server) ListMarketDataFeeds(ctx context.Context, _ ListMarketDataFeedsRequestObject) (ListMarketDataFeedsResponseObject, error) {
	fs, err := s.svc.Feeds(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]MarketDataFeed, len(fs))
	for i, f := range fs {
		items[i] = feedOf(f)
	}

	return ListMarketDataFeeds200JSONResponse{Items: items}, nil
}

func (s *Server) SetMarketDataFeed(ctx context.Context, req SetMarketDataFeedRequestObject) (SetMarketDataFeedResponseObject, error) {
	accept := req.Body.AcceptUnofficial != nil && *req.Body.AcceptUnofficial

	f, err := s.svc.SetFeed(ctx, req.Id, req.Body.Enabled, accept)
	if err != nil {
		return nil, err
	}

	return SetMarketDataFeed200JSONResponse(feedOf(f)), nil
}

func (s *Server) RefreshMarketData(ctx context.Context, _ RefreshMarketDataRequestObject) (RefreshMarketDataResponseObject, error) {
	if err := s.svc.Refresh(ctx); err != nil {
		return nil, err
	}

	return RefreshMarketData202Response{}, nil
}

func feedOf(f domain.Feed) MarketDataFeed {
	out := MarketDataFeed{
		Id: f.ID, Kind: MarketDataFeedKind(f.Kind), Enabled: f.Enabled, Suggested: f.Suggested, Stale: f.Stale,
		LastRun: f.LastRun, Error: f.Error,
		Official: f.Official, Covers: f.Covers, HistoryPending: f.HistoryPending, SymbolOverride: f.SymbolOverride,
	}
	if f.Last != nil {
		out.Last = &openapi_types.Date{Time: *f.Last}
	}

	return out
}
