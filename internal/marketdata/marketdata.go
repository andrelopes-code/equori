// Package marketdata owns instruments, prices and business-day calendars (chapter 4, 4.3.6).
package marketdata

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/marketdata/calendar"
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

// sourceAccrual is the source of the prices computed from the terms of a fixed income security.
const sourceAccrual = domain.SourceAccrual

type Module struct {
	// files reads a file the member attached to the conversation (assistant parity design, F7).
	files toolapi.ConversationFile

	pool  *pgxpool.Pool
	q     *postgres.Queries
	feeds FeedConfig

	profiles       Profiles
	admins         Admins
	onReclassified func(ctx context.Context) error
	sentimentInUse func(ctx context.Context, index string) (bool, error)

	calendars registry.Registry[calendar.Calendar]

	// businessDays are the indexes that compound by business day, computed once in New.
	businessDays domain.BusinessDayIndexes

	// unofficial are the price sources ranked last (A222 MQ2), computed once in New.
	unofficial domain.UnofficialSources

	// holesChecked is the day of the last check of the price holes in this process (A265 PH4); only
	// a tick touches it, and ticks never overlap.
	holesChecked time.Time
	// splitsChecked is the day of the last read of the splits in this process (A266 SA2).
	splitsChecked time.Time

	// running is set while a tick runs, scheduled or requested (ADR 025 F7); a requested tick
	// joins refreshes and stops with life.
	running   atomic.Bool
	refreshes sync.WaitGroup
	// wanted are the feeds to run at once, apart from the tick (A267 FA3); looping is set while RunFeeds
	// reads it.
	wanted  chan string
	looping atomic.Bool
	// jobs counts, by feed, what is queued and what runs (A267 FA1), under runsMu; locks keeps two
	// runs of one feed apart, and accrual two runs of the accrual.
	jobs    map[string]*feedJobs
	locks   sync.Map
	accrual sync.Mutex

	// kick wakes RunFeeds for a requested tick; again is set by a request while a tick may run
	// without it (A222 MQ10).
	kick   chan struct{}
	again  atomic.Bool
	life   context.Context
	stop   context.CancelFunc
	runsMu sync.Mutex
	runs   map[string]feedRun

	// spot holds the current quotes the sources reported (A248 CQ6).
	spot *spotCache
}

func New(pool *pgxpool.Pool) *Module {
	calendars, err := registry.New("calendar",
		registry.Entry[calendar.Calendar]{ID: "br_banking", Value: calendar.BRBanking()},
		registry.Entry[calendar.Calendar]{ID: "weekend", Value: calendar.Weekend()},
	)
	if err != nil {
		panic(
			fmt.Sprintf("marketdata: %v", err),
		) // the entries are literals; a failure is a programming error
	}

	return &Module{
		pool:         pool,
		q:            postgres.New(pool),
		calendars:    calendars,
		businessDays: businessDayIndexes(),
		unofficial:   unofficialSources(),
		kick:         make(chan struct{}, 1),
		wanted:       make(chan string, 64),
		jobs:         map[string]*feedJobs{},
		spot:         newSpotCache(),
	}
}
