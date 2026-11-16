package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

// ErrNotFound is returned by HolidayLister for an unknown calendar.
var ErrNotFound = errors.New("not found")

// HolidayLister is provided by the module root, which owns the calendar rules.
type HolidayLister func(ctx context.Context, calendar string, year int) ([]Holiday, error)

// CalendarLister is provided by the module root, which owns the calendar registry and the owner's region.
type CalendarLister func(ctx context.Context) (CalendarList, error)

// Service is the module root: instruments and prices (P8 amendments A59, A60).
type Service interface {
	DefineInstrument(ctx context.Context, in domain.Instrument) (domain.Instrument, error)
	ListInstruments(ctx context.Context, typ string) ([]domain.Instrument, error)
	Instrument(ctx context.Context, code string) (domain.Instrument, error)
	EditInstrument(
		ctx context.Context, code, typ, name, exchange, subtype string, symbols map[string]string,
		issuer domain.Issuer,
	) (domain.Instrument, error)
	DeleteInstrument(ctx context.Context, code string) error
	HiddenInstruments(ctx context.Context, booksID int64) (map[string]bool, error)
	HideInstrument(ctx context.Context, booksID int64, code string) error
	ShowInstrument(ctx context.Context, booksID int64, code string) error
	PutTerms(ctx context.Context, code string, t domain.Terms) (domain.Terms, error)
	Terms(ctx context.Context, code string) (domain.Terms, error)
	RecordPrices(ctx context.Context, booksID int64, ps []domain.Price) error
	ImportPrices(ctx context.Context, booksID int64, content []byte) (int, error)
	ListPrices(
		ctx context.Context,
		instrument, quote money.Currency,
		from, to time.Time,
	) ([]domain.Price, error)
	ListInstrumentQuotes(ctx context.Context, base money.Currency) ([]domain.InstrumentQuote, error)
	Indexes(ctx context.Context) ([]domain.IndexSummary, error)
	IndexRates(ctx context.Context, id string, from, to time.Time) ([]domain.IndexRate, error)
	Expectations(ctx context.Context, id string) (domain.IndexExpectations, error)
	InstitutionIndicators(
		ctx context.Context, scheme, identifier string,
	) (domain.InstitutionIndicators, error)
	Feeds(ctx context.Context) ([]domain.Feed, error)
	SetFeed(ctx context.Context, id string, enabled, acceptUnofficial bool) (domain.Feed, error)
	Refresh(ctx context.Context) error
	SearchCatalog(ctx context.Context, query string) (domain.CatalogResult, error)
	ProbeQuote(ctx context.Context, in domain.Instrument) (domain.ProbeResult, error)
	RecordInstrumentPrices(
		ctx context.Context, code string, quote money.Currency, points []domain.PricePoint, dryRun bool,
	) (domain.PriceCounts, error)
	RequestHistory(ctx context.Context, code string, from time.Time) error
	Coverage(ctx context.Context, in domain.Instrument) (domain.Coverage, error)
}

type Server struct {
	holidays  HolidayLister
	calendars CalendarLister
	svc       Service
	errs      httpserver.ErrorWriter
}

func NewServer(
	holidays HolidayLister,
	calendars CalendarLister,
	svc Service,
	log *slog.Logger,
) *Server {
	return &Server{
		holidays:  holidays,
		calendars: calendars,
		svc:       svc,
		errs:      httpserver.ErrorWriter{Log: log, Map: ToProblem},
	}
}

// Register lists every route of the market data operations; each handler sits in its topic file.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/calendars",
		httpserver.Handle(s.errs, http.StatusOK, s.listCalendars))
	mux.HandleFunc("GET "+BaseURL+"/calendars/{name}/holidays",
		httpserver.Handle(s.errs, http.StatusOK, s.listHolidays))
	mux.HandleFunc("GET "+BaseURL+"/indexes",
		httpserver.Handle(s.errs, http.StatusOK, s.listIndexes))
	mux.HandleFunc("GET "+BaseURL+"/indexes/{id}/rates",
		httpserver.Handle(s.errs, http.StatusOK, s.listIndexRates))
	mux.HandleFunc("GET "+BaseURL+"/indexes/{id}/expectations",
		httpserver.Handle(s.errs, http.StatusOK, s.listIndexExpectations))
	mux.HandleFunc("GET "+BaseURL+"/market-data/institution-indicators",
		httpserver.Handle(s.errs, http.StatusOK, s.getInstitutionIndicators))
	mux.HandleFunc("GET "+BaseURL+"/market-data/feeds",
		httpserver.Handle(s.errs, http.StatusOK, s.listMarketDataFeeds))
	mux.HandleFunc("PUT "+BaseURL+"/market-data/feeds/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.setMarketDataFeed))
	mux.HandleFunc("POST "+BaseURL+"/market-data/refresh", s.refreshMarketData)
	mux.HandleFunc("GET "+BaseURL+"/market-data/catalog",
		httpserver.Handle(s.errs, http.StatusOK, s.searchInstrumentCatalog))
	mux.HandleFunc("POST "+BaseURL+"/market-data/probe",
		httpserver.Handle(s.errs, http.StatusOK, s.probeQuote))
	mux.HandleFunc("GET "+BaseURL+"/instruments",
		httpserver.Handle(s.errs, http.StatusOK, s.listInstruments))
	mux.HandleFunc("POST "+BaseURL+"/instruments",
		httpserver.HandleCreated(s.errs, s.defineInstrument))
	mux.HandleFunc("GET "+BaseURL+"/instruments/{code}",
		httpserver.Handle(s.errs, http.StatusOK, s.getInstrument))
	mux.HandleFunc("PATCH "+BaseURL+"/instruments/{code}",
		httpserver.Handle(s.errs, http.StatusOK, s.editInstrument))
	mux.HandleFunc("DELETE "+BaseURL+"/instruments/{code}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteInstrument))
	mux.HandleFunc("PUT "+BaseURL+"/instruments/{code}/hidden",
		httpserver.Handle(s.errs, http.StatusOK, s.hideInstrument))
	mux.HandleFunc("DELETE "+BaseURL+"/instruments/{code}/hidden",
		httpserver.Handle(s.errs, http.StatusOK, s.showInstrument))
	mux.HandleFunc("GET "+BaseURL+"/instruments/{code}/terms",
		httpserver.Handle(s.errs, http.StatusOK, s.getInstrumentTerms))
	mux.HandleFunc("PUT "+BaseURL+"/instruments/{code}/terms",
		httpserver.Handle(s.errs, http.StatusOK, s.putInstrumentTerms))
	mux.HandleFunc("POST "+BaseURL+"/instruments/{code}/history", s.requestInstrumentHistory)
	mux.HandleFunc("POST "+BaseURL+"/instruments/{code}/prices",
		httpserver.Handle(s.errs, http.StatusOK, s.recordInstrumentPrices))
	mux.HandleFunc("GET "+BaseURL+"/instrument-quotes",
		httpserver.Handle(s.errs, http.StatusOK, s.listInstrumentQuotes))
	mux.HandleFunc("GET "+BaseURL+"/prices",
		httpserver.Handle(s.errs, http.StatusOK, s.listPrices))
	mux.HandleFunc("POST "+BaseURL+"/prices",
		httpserver.Handle(s.errs, http.StatusCreated, s.recordPrice))
	mux.HandleFunc("POST "+BaseURL+"/prices/import", s.importPrices)
}

// visible returns the instrument of code when the book of ctx may read it (A236 FC1).
func (s *Server) visible(ctx context.Context, code string) (domain.Instrument, error) {
	in, err := s.svc.Instrument(ctx, code)
	if err != nil {
		return domain.Instrument{}, err
	}

	if !in.VisibleTo(auth.MustBooksID(ctx)) {
		return domain.Instrument{}, domain.ErrUnknownInstrument
	}

	return in, nil
}

func (s *Server) listHolidays(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (HolidayList, error) {
	params, err := httpserver.Query[ListHolidaysParams](r)
	if err != nil {
		return HolidayList{}, err
	}

	hs, err := s.holidays(ctx, r.PathValue("name"), params.Year)
	if err != nil {
		return HolidayList{}, err
	}

	return HolidayList{Items: hs}, nil
}

func (s *Server) listCalendars(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (CalendarList, error) {
	list, err := s.calendars(ctx)
	if err != nil {
		return CalendarList{}, err
	}

	return list, nil
}

// NewHoliday builds the API representation; the module root uses it in its HolidayLister.
func NewHoliday(date openapi_types.Date, code, name, source string) Holiday {
	h := Holiday{Date: date, Name: name, Source: HolidaySource(source)}
	if code != "" {
		h.Code = &code
	}

	return h
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}

		return d, true
	}

	if d, ok := notFoundProblem(err); ok {
		return d, true
	}

	switch {
	case errors.Is(err, domain.ErrAdminRequired):
		return problem.New(
			http.StatusForbidden,
			"admin_required",
			"only an admin changes the instance's market data feeds",
		), true
	case errors.Is(err, domain.ErrRefreshRunning):
		return problem.New(
			http.StatusConflict,
			"refresh_running",
			"a tick of the market data feeds is running",
		), true
	case errors.Is(err, domain.ErrUnofficialSource):
		return problem.New(http.StatusUnprocessableEntity, "unofficial_source",
			"the source is not official; enabling it needs accept_unofficial"), true
	case errors.Is(err, domain.ErrNoSource):
		return problem.New(
			http.StatusUnprocessableEntity,
			"no_source",
			"no enabled source quotes the instrument",
		), true
	case errors.Is(err, domain.ErrOddLotCode):
		return problem.New(http.StatusUnprocessableEntity, "odd_lot_code", err.Error()), true
	case errors.Is(err, domain.ErrInstrumentExists):
		return problem.New(http.StatusConflict, "instrument_exists", err.Error()), true
	case errors.Is(err, domain.ErrInstrumentInUse):
		return problem.New(http.StatusConflict, "instrument_in_use",
			"a position, an account or a transaction still uses the instrument"), true
	}

	return problem.Details{}, false
}

// notFoundProblem maps the errors of an absent resource to 404 not_found.
func notFoundProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "unknown calendar"), true
	case errors.Is(err, domain.ErrUnknownInstrument):
		return problem.New(http.StatusNotFound, "not_found", "unknown instrument"), true
	case errors.Is(err, domain.ErrUnknownIndex):
		return problem.New(http.StatusNotFound, "not_found", "unknown index"), true
	case errors.Is(err, domain.ErrUnknownInstitution):
		return problem.New(http.StatusNotFound, "not_found", "unknown institution"), true
	case errors.Is(err, domain.ErrNoTerms):
		return problem.New(http.StatusNotFound, "not_found", "the instrument has no terms"), true
	case errors.Is(err, domain.ErrUnknownFeed):
		return problem.New(http.StatusNotFound, "not_found", "unknown feed"), true
	}

	return problem.Details{}, false
}
