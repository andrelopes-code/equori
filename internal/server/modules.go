package server

import (
	"cmp"
	"log/slog"
	"slices"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/capture"
	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/planning"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio"
	"github.com/andrelopes-code/equori/internal/reporting"
	"github.com/andrelopes-code/equori/web"
)

// modules holds every module constructed by newModules.
type modules struct {
	version        string
	clock          clock.Clock
	dispatcher     *outbox.Dispatcher
	identity       *identity.Module
	marketdata     *marketdata.Module
	ledger         *ledger.Module
	reporting      *reporting.Module
	classification *classification.Module
	assistant      *assistant.Module
	router         *llm.Router
	capture        *capture.Module
	ingestion      *ingestion.Module
	instance       *instance.Module
	portfolio      *portfolio.Module
	planning       *planning.Module
	tools          *tool.Registry
	chatNames      []string
}

// newModules constructs the modules in the order that sets the outbox subscription order and the
// availability of each dependency.
func newModules(
	pool *pgxpool.Pool,
	cfg Config,
	log *slog.Logger,
	dispatcher *outbox.Dispatcher,
	clk clock.Clock,
) (*modules, error) {
	m := &modules{
		version:    cmp.Or(cfg.Version, "dev"),
		clock:      clk,
		dispatcher: dispatcher,
	}

	steps := []func(*pgxpool.Pool, Config, *slog.Logger) error{
		m.addIdentity,
		m.addMarketdata,
		m.addCore,
		m.addAssistant,
		m.addCapture,
		m.addIngestion,
		m.addInstance,
		m.addPortfolio,
		m.addPlanning,
	}
	for _, step := range steps {
		if err := step(pool, cfg, log); err != nil {
			return nil, err
		}
	}

	linkAdapters(m)

	if err := m.buildTools(cfg, log); err != nil {
		return nil, err
	}

	return m, nil
}

func (m *modules) addIdentity(pool *pgxpool.Pool, cfg Config, log *slog.Logger) error {
	module, err := identity.New(pool, identity.Config{
		SecureCookies:     cfg.SecureCookies,
		DefaultCurrency:   ledger.DefaultBaseCurrency,
		SetupDone:         cfg.SetupDone,
		SecretKey:         cfg.SecretKey,
		PreviousSecretKey: cfg.PreviousSecretKey,
		Now:               cfg.IdentityNow,
		PasswordCost:      cfg.PasswordCost,
	}, log)
	if err != nil {
		return err
	}

	m.identity = module
	wireOutbox(m.dispatcher, module)

	return nil
}

func (m *modules) addMarketdata(pool *pgxpool.Pool, cfg Config, log *slog.Logger) error {
	feeds, err := newFeedConfig(cfg, m.version, m.clock, log)
	if err != nil {
		return err
	}

	m.marketdata = marketdata.New(pool).WithFeeds(feeds)
	m.marketdata.WithProfiles(m.identity).WithAdmins(m.identity)

	return nil
}

func (m *modules) addCore(pool *pgxpool.Pool, _ Config, log *slog.Logger) error {
	m.ledger = ledger.New(
		pool,
		m.dispatcher,
		m.marketdata,
		m.identity,
		m.clock,
		log,
	)
	m.reporting = reporting.New(pool, m.dispatcher, m.clock, log, m.version)
	m.classification = classification.New(pool, m.dispatcher, m.ledger, log)

	return nil
}

func (m *modules) addAssistant(pool *pgxpool.Pool, cfg Config, log *slog.Logger) error {
	module, err := assistant.New(pool, assistant.Config{
		SecretKey:         cfg.SecretKey,
		PreviousSecretKey: cfg.PreviousSecretKey,
		Instance:          cfg.LLMProviders,
		Uses: []llm.Use{
			capture.SuggestUse,
			ingestion.SuggestColumnsUse,
			assistant.ChatUse,
		},
		Navigation:   web.NavigationMap(),
		Calculators:  web.CalculatorKeys(),
		BaseCurrency: m.ledger.BaseCurrency,
		Locale:       m.identity.Profile,
		Clock:        m.clock,
		NewProvider:  cfg.LLMFactory,
		Wait:         cfg.LLMWait,
	}, log)
	if err != nil {
		return err
	}

	m.assistant = module
	m.router = llm.NewRouter(&m.clock, log, module.Resolver(), cfg.LLMProviders...)
	module.UseRouter(m.router)

	return nil
}

func (m *modules) addCapture(pool *pgxpool.Pool, _ Config, log *slog.Logger) error {
	m.capture = capture.New(
		pool,
		m.ledger,
		m.classification,
		m.identity,
		m.router,
		m.clock,
		log,
	)

	return nil
}

func (m *modules) addIngestion(pool *pgxpool.Pool, cfg Config, log *slog.Logger) error {
	module, err := ingestion.New(
		pool,
		m.dispatcher,
		m.ledger,
		m.classification,
		m.marketdata,
		ingestion.Config{
			SecretKey:         cfg.SecretKey,
			PreviousSecretKey: cfg.PreviousSecretKey,
			URLs:              cfg.AggregatorURLs,
			Clock:             m.clock,
			InBooks:           m.identity.InBooks,
			Admins:            m.identity,
			Router:            m.router,
		},
		log,
	)
	if err != nil {
		return err
	}

	m.ingestion = module

	return nil
}

func (m *modules) addInstance(pool *pgxpool.Pool, cfg Config, log *slog.Logger) error {
	instanceConfig := cfg.Instance
	instanceConfig.Mode = cmp.Or(instanceConfig.Mode, "external")
	instanceConfig.Version = m.version
	instanceConfig.Clock = m.clock
	instanceConfig.Admins = m.identity
	instanceConfig.SecretKey = cfg.SecretKey
	instanceConfig.PreviousSecretKey = cfg.PreviousSecretKey
	instanceConfig.Outbox = m.dispatcher.Counts
	instanceConfig.Connections = connections(m.ingestion)

	module, err := instance.New(pool, instanceConfig, log)
	if err != nil {
		return err
	}

	m.instance = module
	m.identity.UseUpdateCheck(module.StoreUpdateCheck)

	return nil
}

func (m *modules) addPortfolio(pool *pgxpool.Pool, _ Config, log *slog.Logger) error {
	module, err := portfolio.New(
		pool,
		m.dispatcher,
		m.ledger,
		m.marketdata,
		m.identity,
		log,
	)
	if err != nil {
		return err
	}

	m.portfolio = module
	m.marketdata.WithReclassified(module.RebuildAll)

	return nil
}

func (m *modules) addPlanning(pool *pgxpool.Pool, _ Config, log *slog.Logger) error {
	m.planning = planning.New(
		pool,
		m.dispatcher,
		m.ledger,
		m.marketdata,
		m.identity,
		m.portfolio,
		m.clock,
		log,
	)

	return nil
}

func (m *modules) buildTools(cfg Config, log *slog.Logger) error {
	groups := append([]tool.Group{
		m.ledger.Tools(),
		m.reporting.Tools(),
		m.ingestion.Tools(),
		m.planning.Tools(),
		m.portfolio.Tools(),
		m.marketdata.Tools(),
		m.classification.Tools(),
		m.identity.Tools(),
		m.assistant.Tools(),
	}, cfg.ExtraTools...)

	tools, err := tool.NewRegistry(log, groups...)
	if err != nil {
		return err
	}

	m.tools = tools
	m.chatNames = slices.Collect(func(yield func(string) bool) {
		for _, t := range tools.Tools() {
			if !yield(t.Spec().Name) {
				return
			}
		}
	})

	chatTools, err := tools.Select(m.chatNames...)
	if err != nil {
		return err
	}

	m.assistant.UseViews(
		m.reporting.Views(),
		m.planning.Views(),
		m.ledger.Views(),
		m.portfolio.Views(),
		m.classification.Views(),
		m.marketdata.Views(),
		m.ingestion.Views(),
	)

	return m.assistant.UseTools(chatTools)
}

func newFeedConfig(
	cfg Config,
	version string,
	clk clock.Clock,
	log *slog.Logger,
) (marketdata.FeedConfig, error) {
	feedClient := marketdata.FeedClient(version)
	// Config.PriceFeeds and Config.IndexFeeds are validated here and seed the stored feed settings
	// (ADR 025 F2, F4); production passes none (BK25).
	if _, err := marketdata.NewSources(cfg.PriceFeeds, nil, feedClient, clk.Now); err != nil {
		return marketdata.FeedConfig{}, err
	}

	if _, err := marketdata.NewIndexSources(cfg.IndexFeeds, nil, feedClient); err != nil {
		return marketdata.FeedConfig{}, err
	}

	sources, err := marketdata.NewSources(marketdata.SourceIDs(), cfg.FeedURLs, feedClient, clk.Now)
	if err != nil {
		return marketdata.FeedConfig{}, err
	}

	indexSources, err := marketdata.NewIndexSources(
		marketdata.IndexSourceIDs(),
		cfg.FeedURLs,
		feedClient,
	)
	if err != nil {
		return marketdata.FeedConfig{}, err
	}

	return marketdata.FeedConfig{
		Sources:        sources,
		Indexes:        indexSources,
		Expectations:   marketdata.NewExpectationSources(cfg.FeedURLs, feedClient),
		Curves:         marketdata.NewCurveSources(cfg.FeedURLs, feedClient),
		FundReports:    marketdata.NewFundReportSources(cfg.FeedURLs, feedClient),
		CompanyReports: marketdata.NewCompanyReportSources(cfg.FeedURLs, feedClient),
		Institutions:   marketdata.NewInstitutionSources(cfg.FeedURLs, feedClient),
		Seed:           slices.Concat(cfg.PriceFeeds, cfg.IndexFeeds),
		Client:         feedClient,
		Clock:          clk,
		Log:            log,
		CatalogBound:   cfg.CatalogBound,
		ProbeBound:     cfg.ProbeBound,
		CurrentBound:   cfg.CurrentBound,
	}, nil
}
