package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toIntegrationAPI(i domain.Integration) Integration {
	return Integration{
		Id:         i.ID,
		Aggregator: string(i.Aggregator),
		Name:       i.Name,
		UpdatedAt:  i.UpdatedAt.UTC(),
	}
}

func (s *Server) createIntegration(
	ctx context.Context, _ *http.Request, b CreateIntegrationJSONRequestBody,
) (Integration, string, error) {
	i, err := s.svc.CreateIntegration(ctx, auth.MustBooksID(ctx),
		domain.AggregatorID(b.Aggregator), b.Name, domain.Credentials(b.Credentials))
	if err != nil {
		return Integration{}, "", err
	}

	return toIntegrationAPI(i), BaseURL + "/integrations/" + i.ID.String(), nil
}

func (s *Server) listIntegrations(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (IntegrationList, error) {
	params, err := httpserver.Query[ListIntegrationsParams](r)
	if err != nil {
		return IntegrationList{}, err
	}

	p, err := listPage[app.NameKey](params.Limit, params.Cursor)
	if err != nil {
		return IntegrationList{}, err
	}

	is, next, err := s.svc.ListIntegrations(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return IntegrationList{}, err
	}

	out := IntegrationList{Items: make([]Integration, len(is))}
	for i, x := range is {
		out.Items[i] = toIntegrationAPI(x)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) getIntegration(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Integration, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Integration{}, err
	}

	i, err := s.svc.Integration(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Integration{}, err
	}

	return toIntegrationAPI(i), nil
}

func (s *Server) updateIntegrationCredentials(
	ctx context.Context, r *http.Request, in UpdateIntegrationCredentialsJSONRequestBody,
) (Integration, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Integration{}, err
	}

	i, err := s.svc.UpdateCredentials(ctx, auth.MustBooksID(ctx), id, domain.Credentials(in))
	if err != nil {
		return Integration{}, err
	}

	return toIntegrationAPI(i), nil
}

func (s *Server) createConnectToken(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ConnectToken, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ConnectToken{}, err
	}

	token, err := s.svc.ConnectToken(ctx, auth.MustBooksID(ctx), id)

	return ConnectToken{Token: token}, err
}

func (s *Server) deleteIntegration(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteIntegration(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) listAggregators(
	_ context.Context,
	_ *http.Request,
	_ httpserver.None,
) (AggregatorList, error) {
	all := s.svc.Aggregators()

	out := AggregatorList{Items: make([]Aggregator, len(all))}
	for i, a := range all {
		fields := make([]struct {
			Name   string `json:"name"`
			Secret bool   `json:"secret"`
		}, len(a.CredentialFields()))
		for j, f := range a.CredentialFields() {
			fields[j].Name, fields[j].Secret = f.Name, f.Secret
		}

		out.Items[i] = Aggregator{
			Id:               a.ID(),
			Name:             a.Name(),
			CredentialFields: fields,
			ConnectMethod:    a.ConnectMethod(),
		}
	}

	return out, nil
}
