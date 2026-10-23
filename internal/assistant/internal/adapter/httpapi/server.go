// Package httpapi serves the assistant operations of api/openapi.yaml (ADR 019).
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.errs.WriteRequestError})
}

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func toProblem(err error) (problem.Details, bool) {
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}
		return d, true
	}
	if ce, ok := errors.AsType[*app.CapabilityError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "capability_missing", ce.Error())
		d.Errors = []problem.FieldError{{Field: "targets", Message: ce.Error()}}
		return d, true
	}
	switch {
	case errors.Is(err, domain.ErrKeyRequired):
		d := problem.New(http.StatusUnprocessableEntity, "key_required", err.Error())
		d.Errors = []problem.FieldError{{Field: "key", Message: "is required by the preset"}}
		return d, true
	case errors.Is(err, domain.ErrProviderNotFound):
		return problem.New(http.StatusNotFound, "provider_not_found", err.Error()), true
	case errors.Is(err, domain.ErrUseNotFound):
		return problem.New(http.StatusNotFound, "use_not_found", err.Error()), true
	case errors.Is(err, app.ErrSecretKeyMissing):
		return problem.New(http.StatusConflict, "secret_key_missing", err.Error()), true
	case errors.Is(err, app.ErrProviderUnauthorized):
		return problem.New(http.StatusBadGateway, "provider_unauthorized", app.ErrProviderUnauthorized.Error()), true
	case errors.Is(err, app.ErrProviderUnavailable):
		return problem.New(http.StatusBadGateway, "provider_unavailable", app.ErrProviderUnavailable.Error()), true
	}
	return problem.Details{}, false
}

func caps(in []string) []Capability {
	out := make([]Capability, len(in))
	for i, c := range in {
		out[i] = Capability(c)
	}
	return out
}

func toProvider(v app.ProviderView) Provider {
	return Provider{Id: v.ID, Preset: v.Preset, Name: v.Name, BaseUrl: v.BaseURL, HasKey: v.HasKey, Notice: Notice(v.Notice), Instance: v.Instance}
}

func (s *Server) ListPresets(context.Context, ListPresetsRequestObject) (ListPresetsResponseObject, error) {
	presets := s.svc.Presets()
	items := make([]Preset, len(presets))
	for i, p := range presets {
		models := make([]PresetModel, len(p.Models))
		for j, m := range p.Models {
			models[j] = PresetModel{Id: m.ID, Capabilities: caps(m.Capabilities)}
		}
		items[i] = Preset{Id: p.ID, Api: string(p.API), BaseUrl: p.BaseURL, KeyRequired: p.KeyRequired, Notice: Notice(p.Notice), Models: models}
	}
	return ListPresets200JSONResponse{Items: items}, nil
}

func (s *Server) ListProviders(ctx context.Context, _ ListProvidersRequestObject) (ListProvidersResponseObject, error) {
	views, err := s.svc.Providers(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]Provider, len(views))
	for i, v := range views {
		items[i] = toProvider(v)
	}
	return ListProviders200JSONResponse{Items: items}, nil
}

func value(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (s *Server) CreateProvider(ctx context.Context, req CreateProviderRequestObject) (CreateProviderResponseObject, error) {
	b := req.Body
	v, err := s.svc.CreateProvider(ctx, auth.MustUserID(ctx), app.ProviderInput{
		Preset: b.Preset, Name: b.Name, BaseURL: value(b.BaseUrl), Key: value(b.Key),
	})
	if err != nil {
		return nil, err
	}
	return CreateProvider201JSONResponse(toProvider(v)), nil
}

func (s *Server) UpdateProvider(ctx context.Context, req UpdateProviderRequestObject) (UpdateProviderResponseObject, error) {
	v, err := s.svc.UpdateProvider(ctx, auth.MustUserID(ctx), req.Id, app.ProviderPatch{
		Name: req.Body.Name, BaseURL: req.Body.BaseUrl, Key: req.Body.Key,
	})
	if err != nil {
		return nil, err
	}
	return UpdateProvider200JSONResponse(toProvider(v)), nil
}

func (s *Server) DeleteProvider(ctx context.Context, req DeleteProviderRequestObject) (DeleteProviderResponseObject, error) {
	if err := s.svc.DeleteProvider(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteProvider204Response{}, nil
}

func (s *Server) ListProviderModels(ctx context.Context, req ListProviderModelsRequestObject) (ListProviderModelsResponseObject, error) {
	ids, err := s.svc.ProviderModels(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	if ids == nil {
		ids = []string{}
	}
	return ListProviderModels200JSONResponse{Items: ids}, nil
}

func toUse(v app.UseView) Use {
	targets := make([]UseTarget, len(v.Targets))
	for i, t := range v.Targets {
		p, _ := domain.FindPreset(t.Preset)
		targets[i] = UseTarget{
			ProviderId: t.ProviderID, ProviderName: t.ProviderName, Preset: t.Preset, Notice: Notice(p.Notice),
			Model: t.Model, Capabilities: caps(t.Capabilities),
		}
	}
	return Use{Id: v.Use.ID, Needs: caps(v.Use.Needs), SendsFinancialData: v.Use.SendsFinancialData, Default: v.Default, Targets: targets}
}

func (s *Server) ListUses(ctx context.Context, _ ListUsesRequestObject) (ListUsesResponseObject, error) {
	views, err := s.svc.Uses(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]Use, len(views))
	for i, v := range views {
		items[i] = toUse(v)
	}
	return ListUses200JSONResponse{Items: items}, nil
}

func (s *Server) SetUseChain(ctx context.Context, req SetUseChainRequestObject) (SetUseChainResponseObject, error) {
	userID := auth.MustUserID(ctx)
	in := make([]app.ChainInput, len(req.Body.Targets))
	for i, t := range req.Body.Targets {
		in[i] = app.ChainInput{ProviderID: uuid.UUID(t.ProviderId), Model: t.Model}
		if t.Capabilities != nil {
			for _, c := range *t.Capabilities {
				in[i].Capabilities = append(in[i].Capabilities, string(c))
			}
		}
	}
	if err := s.svc.SetChain(ctx, userID, req.Use, in); err != nil {
		return nil, err
	}
	views, err := s.svc.Uses(ctx, userID)
	if err != nil {
		return nil, err
	}
	i := slices.IndexFunc(views, func(v app.UseView) bool { return v.Use.ID == req.Use })
	return SetUseChain200JSONResponse(toUse(views[i])), nil
}
