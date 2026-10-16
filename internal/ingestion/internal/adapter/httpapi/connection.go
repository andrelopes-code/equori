package httpapi

import (
	"context"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toExternalAccountAPI(a domain.ExternalAccount) ExternalAccount {
	out := ExternalAccount{
		Id: a.ID, Type: a.Type, Subtype: a.Subtype, Name: a.Name, NumberLast4: ref(a.NumberLast4), Currency: a.Currency,
		State: ExternalAccountState(a.State()), AccountId: a.AccountID,
	}
	if a.SyncFrom != nil {
		out.SyncFrom = &openapi_types.Date{Time: *a.SyncFrom}
	}
	if a.LastSyncedOn != nil {
		out.LastSyncedOn = &openapi_types.Date{Time: *a.LastSyncedOn}
	}
	return out
}

func utc(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	u := t.UTC()
	return &u
}

func toConnectionAPI(c domain.Connection) Connection {
	out := Connection{
		Id: c.ID, IntegrationId: c.IntegrationID, ItemId: c.ItemID, Name: c.Name, ProviderStatus: c.ProviderStatus,
		LastItemUpdateAt: utc(c.LastItemUpdateAt), LastSyncedAt: utc(c.LastSyncedAt), LastError: ref(c.LastError), CreatedAt: c.CreatedAt.UTC(),
		Accounts: make([]ExternalAccount, len(c.Accounts)),
	}
	for i, a := range c.Accounts {
		out.Accounts[i] = toExternalAccountAPI(a)
	}
	return out
}

func (s *Server) CreateConnection(ctx context.Context, req CreateConnectionRequestObject) (CreateConnectionResponseObject, error) {
	b := req.Body
	c, err := s.svc.CreateConnection(ctx, auth.MustUserID(ctx), b.IntegrationId, b.ItemId, opt(b.Name))
	if err != nil {
		return nil, err
	}
	location := BaseURL + "/connections/" + c.ID.String()
	return CreateConnection201JSONResponse{Body: toConnectionAPI(c), Headers: CreateConnection201ResponseHeaders{Location: &location}}, nil
}

func (s *Server) ListConnections(ctx context.Context, req ListConnectionsRequestObject) (ListConnectionsResponseObject, error) {
	p, err := listPage[app.NameKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	cs, next, err := s.svc.ListConnections(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListConnections200JSONResponse{Items: make([]Connection, len(cs))}
	for i, c := range cs {
		out.Items[i] = toConnectionAPI(c)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) GetConnection(ctx context.Context, req GetConnectionRequestObject) (GetConnectionResponseObject, error) {
	c, err := s.svc.Connection(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetConnection200JSONResponse(toConnectionAPI(c)), nil
}

func (s *Server) DeleteConnection(ctx context.Context, req DeleteConnectionRequestObject) (DeleteConnectionResponseObject, error) {
	if err := s.svc.DeleteConnection(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteConnection204Response{}, nil
}

func (s *Server) MapExternalAccount(ctx context.Context, req MapExternalAccountRequestObject) (MapExternalAccountResponseObject, error) {
	b := req.Body
	m := domain.Mapping{AccountID: b.AccountId, Ignored: b.Ignored != nil && *b.Ignored}
	if b.SyncFrom != nil {
		m.SyncFrom = &b.SyncFrom.Time
	}
	a, err := s.svc.MapAccount(ctx, auth.MustUserID(ctx), req.Id, req.ExternalAccountId, m)
	if err != nil {
		return nil, err
	}
	return MapExternalAccount200JSONResponse(toExternalAccountAPI(a)), nil
}
