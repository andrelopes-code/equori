// Package httpapi serves the assistant operations of api/openapi.yaml (ADR 019).
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
	log  *slog.Logger
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}, log: log}
}

// Register lists every route of the assistant operations; each handler sits in its topic file.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/assistant/presets",
		httpserver.Handle(s.errs, http.StatusOK, s.listPresets))
	mux.HandleFunc("GET "+BaseURL+"/assistant/providers",
		httpserver.Handle(s.errs, http.StatusOK, s.listProviders))
	mux.HandleFunc("POST "+BaseURL+"/assistant/providers",
		httpserver.Handle(s.errs, http.StatusCreated, s.createProvider))
	mux.HandleFunc("PATCH "+BaseURL+"/assistant/providers/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.updateProvider))
	mux.HandleFunc("DELETE "+BaseURL+"/assistant/providers/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteProvider))
	mux.HandleFunc("GET "+BaseURL+"/assistant/providers/{id}/models",
		httpserver.Handle(s.errs, http.StatusOK, s.listProviderModels))
	mux.HandleFunc("GET "+BaseURL+"/assistant/usage",
		httpserver.Handle(s.errs, http.StatusOK, s.listUsage))
	mux.HandleFunc("GET "+BaseURL+"/assistant/usage/days",
		httpserver.Handle(s.errs, http.StatusOK, s.listUsageDays))
	mux.HandleFunc("PUT "+BaseURL+"/assistant/usage/limits",
		httpserver.Handle(s.errs, http.StatusOK, s.setUsageLimit))
	mux.HandleFunc("GET "+BaseURL+"/assistant/chat",
		httpserver.Handle(s.errs, http.StatusOK, s.getAssistantChat))
	mux.HandleFunc("POST "+BaseURL+"/assistant/turns", s.sendAssistantMessage)
	mux.HandleFunc("GET "+BaseURL+"/assistant/conversations",
		httpserver.Handle(s.errs, http.StatusOK, s.listAssistantConversations))
	mux.HandleFunc("DELETE "+BaseURL+"/assistant/conversations",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteAssistantConversations))
	mux.HandleFunc("GET "+BaseURL+"/assistant/conversations/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getAssistantConversation))
	mux.HandleFunc("DELETE "+BaseURL+"/assistant/conversations/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteAssistantConversation))
	mux.HandleFunc("POST "+BaseURL+"/assistant/files", s.createAssistantFile)
	mux.HandleFunc("DELETE "+BaseURL+"/assistant/files/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteAssistantFile))
	mux.HandleFunc("POST "+BaseURL+"/assistant/proposals/{id}/confirm",
		httpserver.Handle(s.errs, http.StatusOK, s.confirmAssistantProposal))
	mux.HandleFunc("POST "+BaseURL+"/assistant/proposals/{id}/reject",
		httpserver.Handle(s.errs, http.StatusOK, s.rejectAssistantProposal))
	mux.HandleFunc("GET "+BaseURL+"/assistant/uses",
		httpserver.Handle(s.errs, http.StatusOK, s.listUses))
	mux.HandleFunc("PUT "+BaseURL+"/assistant/uses/{use}/chain",
		httpserver.Handle(s.errs, http.StatusOK, s.setUseChain))
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

	if le, ok := errors.AsType[*app.LimitError](err); ok {
		return problem.WithRetryAt(problem.New(
			http.StatusTooManyRequests,
			"assistant_exhausted",
			"every language model of the assistant is cooling down or over its daily limit until retry_at",
		), le.RetryAt), true
	}

	switch {
	case errors.Is(err, app.ErrChatUnavailable):
		return problem.New(
			http.StatusServiceUnavailable,
			"assistant_unavailable",
			"no language model provider serves the assistant; add one in Settings",
		), true
	case errors.Is(err, app.ErrTurnFailed):
		return problem.New(
			http.StatusBadGateway,
			"assistant_failed",
			"the language model provider refused the request",
		), true
	case errors.Is(err, app.ErrInvalidUsageRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", err.Error())
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 89 days after it"},
		}

		return d, true
	case errors.Is(err, app.ErrInvalidText), errors.Is(err, app.ErrTooManyFiles):
		return problem.New(http.StatusBadRequest, "invalid_request", err.Error()), true
	case errors.Is(err, domain.ErrConversationNotFound):
		return problem.New(
			http.StatusNotFound,
			"conversation_not_found",
			"conversation not found",
		), true
	case errors.Is(err, domain.ErrKeyRequired):
		d := problem.New(http.StatusUnprocessableEntity, "key_required", err.Error())
		d.Errors = []problem.FieldError{{Field: "key", Message: "is required by the preset"}}

		return d, true
	case errors.Is(err, domain.ErrProviderNotFound):
		return problem.New(http.StatusNotFound, "provider_not_found", err.Error()), true
	case errors.Is(err, domain.ErrProposalNotFound):
		return problem.New(http.StatusNotFound, "proposal_not_found", "proposal not found"), true
	case errors.Is(err, app.ErrProposalClosed):
		return problem.New(
			http.StatusConflict,
			"proposal_closed",
			"the proposal was already decided",
		), true
	case errors.Is(err, app.ErrProposalExpired):
		return problem.New(
			http.StatusConflict,
			"proposal_expired",
			"the proposal expired; ask the assistant again",
		), true
	case errors.Is(err, app.ErrProposalWaiting):
		return problem.New(
			http.StatusConflict,
			"proposal_waiting",
			"the proposal waits for the confirmation of another proposal",
		), true
	case errors.Is(err, app.ErrProposalStale):
		return problem.New(
			http.StatusConflict,
			"proposal_stale",
			"the data changed after the proposal; ask the assistant again",
		), true
	case errors.Is(err, domain.ErrUseNotFound):
		return problem.New(http.StatusNotFound, "use_not_found", err.Error()), true
	case errors.Is(err, app.ErrSecretKeyMissing):
		return problem.New(http.StatusConflict, "secret_key_missing", err.Error()), true
	case errors.Is(err, app.ErrProviderUnauthorized):
		return problem.New(
			http.StatusBadGateway,
			"provider_unauthorized",
			app.ErrProviderUnauthorized.Error(),
		), true
	case errors.Is(err, app.ErrProviderUnavailable):
		return problem.New(
			http.StatusBadGateway,
			"provider_unavailable",
			app.ErrProviderUnavailable.Error(),
		), true
	}

	return fileProblem(err)
}

func caps(in []string) []Capability {
	out := make([]Capability, len(in))
	for i, c := range in {
		out[i] = Capability(c)
	}

	return out
}

func toProvider(v app.ProviderView) Provider {
	return Provider{
		Id:       v.ID,
		Preset:   v.Preset,
		Name:     v.Name,
		BaseUrl:  v.BaseURL,
		HasKey:   v.HasKey,
		Notice:   Notice(v.Notice),
		Instance: v.Instance,
	}
}

func (s *Server) listPresets(context.Context, *http.Request, httpserver.None) (PresetList, error) {
	presets := s.svc.Presets()

	items := make([]Preset, len(presets))
	for i, p := range presets {
		models := make([]PresetModel, len(p.Models))
		for j, m := range p.Models {
			models[j] = PresetModel{Id: m.ID, Capabilities: caps(m.Capabilities)}
		}

		items[i] = Preset{
			Id:          p.ID,
			Api:         string(p.API),
			BaseUrl:     p.BaseURL,
			KeyRequired: p.KeyRequired,
			Notice:      Notice(p.Notice),
			Models:      models,
		}
	}

	return PresetList{Items: items}, nil
}

func (s *Server) listProviders(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (ProviderList, error) {
	views, err := s.svc.Providers(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return ProviderList{}, err
	}

	items := make([]Provider, len(views))
	for i, v := range views {
		items[i] = toProvider(v)
	}

	return ProviderList{Items: items}, nil
}

func value(p *string) string {
	if p == nil {
		return ""
	}

	return *p
}

func (s *Server) createProvider(
	ctx context.Context,
	_ *http.Request,
	in CreateProviderJSONRequestBody,
) (Provider, error) {
	v, err := s.svc.CreateProvider(ctx, auth.MustBooksID(ctx), app.ProviderInput{
		Preset: in.Preset, Name: in.Name, BaseURL: value(in.BaseUrl), Key: value(in.Key),
	})
	if err != nil {
		return Provider{}, err
	}

	return toProvider(v), nil
}

func (s *Server) updateProvider(
	ctx context.Context,
	r *http.Request,
	in UpdateProviderJSONRequestBody,
) (Provider, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Provider{}, err
	}

	v, err := s.svc.UpdateProvider(ctx, auth.MustBooksID(ctx), id, app.ProviderPatch{
		Name: in.Name, BaseURL: in.BaseUrl, Key: in.Key,
	})
	if err != nil {
		return Provider{}, err
	}

	return toProvider(v), nil
}

func (s *Server) deleteProvider(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteProvider(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) listProviderModels(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ProviderModels, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ProviderModels{}, err
	}

	ids, err := s.svc.ProviderModels(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ProviderModels{}, err
	}

	if ids == nil {
		ids = []string{}
	}

	return ProviderModels{Items: ids}, nil
}

func toUse(v app.UseView) Use {
	targets := make([]UseTarget, len(v.Targets))
	for i, t := range v.Targets {
		p, _ := domain.FindPreset(t.Preset)
		targets[i] = UseTarget{
			ProviderId:   t.ProviderID,
			ProviderName: t.ProviderName,
			Preset:       t.Preset,
			Notice:       Notice(p.Notice),
			Model:        t.Model,
			Capabilities: caps(t.Capabilities),
		}
	}

	return Use{
		Id:                 v.Use.ID,
		Needs:              caps(v.Use.Needs),
		SendsFinancialData: v.Use.SendsFinancialData,
		Default:            v.Default,
		Targets:            targets,
	}
}

func (s *Server) listUses(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (UseList, error) {
	views, err := s.svc.Uses(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return UseList{}, err
	}

	items := make([]Use, len(views))
	for i, v := range views {
		items[i] = toUse(v)
	}

	return UseList{Items: items}, nil
}

func (s *Server) setUseChain(
	ctx context.Context,
	r *http.Request,
	body SetUseChainJSONRequestBody,
) (Use, error) {
	booksID := auth.MustBooksID(ctx)
	use := r.PathValue("use")

	in := make([]app.ChainInput, len(body.Targets))
	for i, t := range body.Targets {
		in[i] = app.ChainInput{ProviderID: uuid.UUID(t.ProviderId), Model: t.Model}
		if t.Capabilities != nil {
			for _, c := range *t.Capabilities {
				in[i].Capabilities = append(in[i].Capabilities, string(c))
			}
		}
	}

	if err := s.svc.SetChain(ctx, booksID, use, in); err != nil {
		return Use{}, err
	}

	views, err := s.svc.Uses(ctx, booksID)
	if err != nil {
		return Use{}, err
	}

	i := slices.IndexFunc(views, func(v app.UseView) bool { return v.Use.ID == use })

	return toUse(views[i]), nil
}
