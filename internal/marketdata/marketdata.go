// Package marketdata owns instruments, prices and business-day calendars (chapter 4, 4.3.6).
package marketdata

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/marketdata/calendar"
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

// sourceAccrual is the source of the prices computed from the terms of a fixed income security.
const sourceAccrual = domain.SourceAccrual

type Module struct {
	pool  *pgxpool.Pool
	q     *postgres.Queries
	feeds FeedConfig

	profiles Profiles
	admins   Admins

	calendars registry.Registry[calendar.Calendar]

	// businessDays are the indexes that compound by business day, computed once in New.
	businessDays domain.BusinessDayIndexes

	// unofficial are the price sources ranked last (A222 MQ2), computed once in New.
	unofficial domain.UnofficialSources

	// running is set while a tick runs, scheduled or requested (ADR 025 F7); a requested tick
	// joins refreshes and stops with life.
	running   atomic.Bool
	refreshes sync.WaitGroup
	// kick wakes RunFeeds for a requested tick; again is set by a request while a tick may run
	// without it (A222 MQ10).
	kick   chan struct{}
	again  atomic.Bool
	life   context.Context
	stop   context.CancelFunc
	runsMu sync.Mutex
	runs   map[string]feedRun
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
		pool: pool, q: postgres.New(pool), calendars: calendars, businessDays: businessDayIndexes(),
		unofficial: unofficialSources(), kick: make(chan struct{}, 1),
	}
}
