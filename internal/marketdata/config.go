package marketdata

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/expectation"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/institution"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// feedWindowDays bounds how far back a feed fetches (P8 amendment A62).
const feedWindowDays = 30

// FeedConfig lists every price and index source of the registry; the stored settings choose
// the ones TickFeeds runs (ADR 025).
type FeedConfig struct {
	Sources []feed.Source
	// Indexes are the index sources (investments design 4.2).
	Indexes []index.Source
	// Expectations are the expectation sources (ADR 026).
	Expectations []expectation.Source
	// Institutions are the institution sources (A237).
	Institutions []institution.Source
	// Seed names the sources enabled while no setting is stored; tests set it through
	// server.Config, production passes none (ADR 025 F2, ADR 029 BK25).
	Seed []string
	// CatalogBound and ProbeBound bound one source in a catalog search and in a probe; WithFeeds
	// sets 3 and 5 seconds when zero (A222 MQ27, MQ29).
	CatalogBound, ProbeBound time.Duration
	// CurrentBound bounds the wait of a read for current quotes; WithFeeds sets 3 seconds when
	// zero (A248 CQ14).
	CurrentBound time.Duration

	Client *http.Client
	Clock  clock.Clock
	Log    *slog.Logger
}

// Profiles gives the language and region of a book (identity).
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

// Admins tells whether a user may change the instance (identity).
type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// WithFeeds sets the feeds; the composition root calls it once.
func (m *Module) WithFeeds(cfg FeedConfig) *Module {
	if cfg.CatalogBound == 0 {
		cfg.CatalogBound = 3 * time.Second
	}

	if cfg.ProbeBound == 0 {
		cfg.ProbeBound = 5 * time.Second
	}

	if cfg.CurrentBound == 0 {
		cfg.CurrentBound = 3 * time.Second
	}

	m.feeds = cfg
	m.life, m.stop = context.WithCancel(context.Background())

	return m
}

// WithProfiles sets where the region of the calling book comes from; the composition root calls it once.
func (m *Module) WithProfiles(p Profiles) *Module {
	m.profiles = p
	return m
}

// WithReclassified sets the function that runs after an edit changes what other modules derive
// from an instrument: its type, subtype or exchange (A224); the composition root calls it once.
func (m *Module) WithReclassified(fn func(ctx context.Context) error) *Module {
	m.onReclassified = fn
	return m
}

func (m *Module) reclassified(ctx context.Context) error {
	if m.onReclassified == nil {
		return nil
	}

	return m.onReclassified(ctx)
}

// WithAdmins sets who may change the feeds; the composition root calls it once.
func (m *Module) WithAdmins(a Admins) *Module {
	m.admins = a
	return m
}
