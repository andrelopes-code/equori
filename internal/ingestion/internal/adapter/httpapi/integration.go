package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toIntegrationAPI(i domain.Integration) Integration {
	return Integration{Id: i.ID, Aggregator: string(i.Provider), Name: i.Name, UpdatedAt: i.UpdatedAt.UTC()}
}

func (s *Server) CreateIntegration(ctx context.Context, req CreateIntegrationRequestObject) (CreateIntegrationResponseObject, error) {
	b := req.Body
	i, err := s.svc.CreateIntegration(ctx, auth.MustUserID(ctx), domain.Provider(b.Aggregator), b.Name,
		domain.Credentials(b.Credentials))
	if err != nil {
		return nil, err
	}
	location := BaseURL + "/integrations/" + i.ID.String()
	return CreateIntegration201JSONResponse{Body: toIntegrationAPI(i), Headers: CreateIntegration201ResponseHeaders{Location: &location}}, nil
}

func (s *Server) ListIntegrations(ctx context.Context, req ListIntegrationsRequestObject) (ListIntegrationsResponseObject, error) {
	p, err := listPage[app.NameKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	is, next, err := s.svc.ListIntegrations(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListIntegrations200JSONResponse{Items: make([]Integration, len(is))}
	for i, x := range is {
		out.Items[i] = toIntegrationAPI(x)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) GetIntegration(ctx context.Context, req GetIntegrationRequestObject) (GetIntegrationResponseObject, error) {
	i, err := s.svc.Integration(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetIntegration200JSONResponse(toIntegrationAPI(i)), nil
}

func (s *Server) UpdateIntegrationCredentials(ctx context.Context, req UpdateIntegrationCredentialsRequestObject) (UpdateIntegrationCredentialsResponseObject, error) {
	i, err := s.svc.UpdateCredentials(ctx, auth.MustUserID(ctx), req.Id, domain.Credentials(*req.Body))
	if err != nil {
		return nil, err
	}
	return UpdateIntegrationCredentials200JSONResponse(toIntegrationAPI(i)), nil
}

func (s *Server) DeleteIntegration(ctx context.Context, req DeleteIntegrationRequestObject) (DeleteIntegrationResponseObject, error) {
	if err := s.svc.DeleteIntegration(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteIntegration204Response{}, nil
}

func (s *Server) ListAggregators(ctx context.Context, _ ListAggregatorsRequestObject) (ListAggregatorsResponseObject, error) {
	all := s.svc.Aggregators()
	out := ListAggregators200JSONResponse{Items: make([]Aggregator, len(all))}
	for i, a := range all {
		fields := make([]struct {
			Name   string `json:"name"`
			Secret bool   `json:"secret"`
		}, len(a.CredentialFields()))
		for j, f := range a.CredentialFields() {
			fields[j].Name, fields[j].Secret = f.Name, f.Secret
		}
		out.Items[i] = Aggregator{Id: a.ID(), Name: a.Name(), CredentialFields: fields, ConnectMethod: a.ConnectMethod()}
	}
	return out, nil
}
