package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toExternalAccountAPI(a domain.ExternalAccount) ExternalAccount {
	out := ExternalAccount{
		Id:          a.ID,
		Type:        a.Type,
		Subtype:     a.Subtype,
		Name:        a.Name,
		NumberLast4: ref(a.NumberLast4),
		Currency:    a.Currency,
		State:       ExternalAccountState(a.State()),
		AccountId:   a.AccountID,
	}
	if a.SyncFrom != nil {
		out.SyncFrom = &openapi_types.Date{Time: *a.SyncFrom}
	}

	if a.LastSyncedOn != nil {
		out.LastSyncedOn = &openapi_types.Date{Time: *a.LastSyncedOn}
	}

	if a.GoneSince != nil {
		out.GoneSince = &openapi_types.Date{Time: *a.GoneSince}
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
		Id:             c.ID,
		IntegrationId:  c.IntegrationID,
		ExternalId:     c.ExternalID,
		State:          ConnectionState(c.State),
		Name:           c.Name,
		ProviderStatus: c.ProviderStatus,
		Portal: ref(
			c.Portal,
		),
		LastItemUpdateAt: utc(c.LastItemUpdateAt),
		NextItemUpdateAt: utc(c.NextItemUpdateAt),
		LastSyncedAt:     utc(c.LastSyncedAt),
		ConsentExpiresAt: utc(c.ConsentExpiresAt),
		LastError:        ref(c.LastError),
		CreatedAt:        c.CreatedAt.UTC(),
		Accounts:         make([]ExternalAccount, len(c.Accounts)),
	}
	for i, a := range c.Accounts {
		out.Accounts[i] = toExternalAccountAPI(a)
	}

	return out
}

func (s *Server) createConnection(
	ctx context.Context, _ *http.Request, b CreateConnectionJSONRequestBody,
) (Connection, string, error) {
	c, err := s.svc.CreateConnection(
		ctx,
		auth.MustBooksID(ctx),
		b.IntegrationId,
		b.ExternalId,
		opt(b.Name),
	)
	if err != nil {
		return Connection{}, "", err
	}

	return toConnectionAPI(c), BaseURL + "/connections/" + c.ID.String(), nil
}

func (s *Server) listConnections(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ConnectionList, error) {
	params, err := httpserver.Query[ListConnectionsParams](r)
	if err != nil {
		return ConnectionList{}, err
	}

	p, err := listPage[app.NameKey](params.Limit, params.Cursor)
	if err != nil {
		return ConnectionList{}, err
	}

	cs, next, err := s.svc.ListConnections(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return ConnectionList{}, err
	}

	out := ConnectionList{Items: make([]Connection, len(cs))}
	for i, c := range cs {
		out.Items[i] = toConnectionAPI(c)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) getConnection(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Connection, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Connection{}, err
	}

	c, err := s.svc.Connection(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Connection{}, err
	}

	return toConnectionAPI(c), nil
}

func (s *Server) deleteConnection(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteConnection(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) mapExternalAccount(
	ctx context.Context, r *http.Request, b MapExternalAccountJSONRequestBody,
) (ExternalAccount, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ExternalAccount{}, err
	}

	externalAccountID, err := httpserver.PathUUID(r, "external_account_id")
	if err != nil {
		return ExternalAccount{}, err
	}

	m := domain.Mapping{AccountID: b.AccountId, Ignored: b.Ignored != nil && *b.Ignored}
	if b.SyncFrom != nil {
		m.SyncFrom = &b.SyncFrom.Time
	}

	a, err := s.svc.MapAccount(ctx, auth.MustBooksID(ctx), id, externalAccountID, m)
	if err != nil {
		return ExternalAccount{}, err
	}

	return toExternalAccountAPI(a), nil
}

func (s *Server) syncConnection(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (SyncResult, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return SyncResult{}, err
	}

	c, batches, err := s.svc.SyncConnection(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return SyncResult{}, err
	}

	out := SyncResult{Connection: toConnectionAPI(c), Batches: make([]ImportBatch, len(batches))}
	for i, b := range batches {
		out.Batches[i] = toBatchAPI(b)
	}

	return out, nil
}

func (s *Server) listConnectionSyncs(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (SyncRunList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return SyncRunList{}, err
	}

	runs, err := s.svc.SyncRuns(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return SyncRunList{}, err
	}

	out := SyncRunList{Items: make([]SyncRun, len(runs))}
	for i, run := range runs {
		currency := make(map[uuid.UUID]string, len(run.Batches))
		item := SyncRun{
			SyncId:    run.ID,
			StartedAt: run.StartedAt.UTC(),
			Batches: make(
				[]ImportBatch,
				len(run.Batches),
			),
			Records: make([]ExternalRecord, len(run.Records)),
		}

		for j, b := range run.Batches {
			item.Batches[j] = toBatchAPI(b)
			currency[b.ID] = b.Currency
		}

		for j, rec := range run.Records {
			item.Records[j] = toRecordAPI(rec, currency[rec.SummaryBatchID])
		}

		out.Items[i] = item
	}

	return out, nil
}
