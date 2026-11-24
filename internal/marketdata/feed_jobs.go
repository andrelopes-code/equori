package marketdata

import (
	"context"
	"slices"
	"sync"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
)

// feedJob is one step of a tick: a run of one feed, or of its pending histories.
type feedJob struct {
	id  string
	run func(ctx context.Context) error
	// follows is true for a step after the one that fetches the feed: a success keeps the state of
	// that one. silent is true for a step that logs its own failures.
	follows, silent bool
}

// feedJobs counts the jobs of one feed (A267 FA1).
type feedJobs struct{ queued, running int }

// jobsOf are the steps of a tick over the enabled feeds, the shortest first (A267 FA2).
func (m *Module) jobsOf(on map[string]bool) []feedJob {
	var jobs []feedJob

	for _, src := range m.feeds.Indexes {
		jobs = append(jobs, feedJob{id: src.ID(), run: func(ctx context.Context) error {
			return m.tickIndex(ctx, src)
		}})
	}

	for _, src := range m.feeds.Expectations {
		jobs = append(jobs, feedJob{id: src.ID(), run: func(ctx context.Context) error {
			return m.tickExpectation(ctx, src)
		}})
	}

	for _, src := range m.feeds.Curves {
		jobs = append(jobs, feedJob{id: src.ID(), run: func(ctx context.Context) error {
			return m.tickCurve(ctx, src)
		}})
	}

	for _, src := range m.feeds.Sources {
		jobs = append(
			jobs,
			feedJob{id: src.ID(), silent: true, run: func(ctx context.Context) error {
				return m.tick(ctx, src)
			}},
		)
	}

	jobs = append(jobs, m.longJobs()...)

	return slices.DeleteFunc(jobs, func(j feedJob) bool { return !on[j.id] })
}

// longJobs are the steps that read files of many megabytes: the institutions, the reports and the
// pending histories of the prices.
func (m *Module) longJobs() []feedJob {
	var jobs []feedJob

	for _, src := range m.feeds.Institutions {
		jobs = append(jobs, feedJob{id: src.ID(), run: func(ctx context.Context) error {
			return m.tickInstitution(ctx, src)
		}})
	}

	for _, src := range m.feeds.FundReports {
		jobs = append(jobs, feedJob{id: src.ID(), run: func(ctx context.Context) error {
			return m.tickFundReport(ctx, src)
		}})
	}

	for _, src := range m.feeds.CompanyReports {
		jobs = append(jobs, feedJob{id: src.ID(), run: func(ctx context.Context) error {
			return m.tickCompanyReport(ctx, src)
		}})
	}

	for _, src := range m.feeds.Sources {
		jobs = append(jobs, feedJob{
			id:      src.ID(),
			follows: true,
			silent:  true,
			run: func(ctx context.Context) error {
				return m.tickHistory(ctx, src)
			},
		})
	}

	return jobs
}

// enqueue counts jobs as queued.
func (m *Module) enqueue(jobs []feedJob) {
	m.runsMu.Lock()
	defer m.runsMu.Unlock()

	for _, j := range jobs {
		m.jobOf(j.id).queued++
	}
}

// runJob runs a queued job and keeps its outcome; a feed that another worker runs is left to it.
func (m *Module) runJob(ctx context.Context, j feedJob) {
	lock, _ := m.locks.LoadOrStore(j.id, new(sync.Mutex))
	mu, _ := lock.(*sync.Mutex)

	if !mu.TryLock() {
		m.move(j.id, -1, 0)
		return
	}

	defer mu.Unlock()

	m.move(j.id, -1, 1)
	defer m.move(j.id, 0, -1)

	err := j.run(ctx)
	if err != nil && !j.silent {
		m.logFeed(ctx, err, "source", j.id)
	}

	if err != nil || !j.follows {
		m.ran(j.id, err)
	}
}

// want asks for a run of a feed at once, apart from the tick (A267 FA3); without RunFeeds nothing runs
// it.
func (m *Module) want(id string) {
	if !m.looping.Load() {
		return
	}

	m.move(id, 1, 0)

	select {
	case m.wanted <- id:
	default:
		m.move(id, -1, 0)
	}
}

// runWanted runs the wanted feeds, one at a time, until ctx ends.
func (m *Module) runWanted(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case id := <-m.wanted:
			m.runFeed(ctx, id)
			m.move(id, -1, 0)
		}
	}
}

// runFeed runs every job of an enabled feed, then the accrual over what it read.
func (m *Module) runFeed(ctx context.Context, id string) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		m.logFeed(ctx, err, "source", id)
		return
	}

	jobs := slices.DeleteFunc(m.jobsOf(on), func(j feedJob) bool { return j.id != id })
	m.enqueue(jobs)

	for _, j := range jobs {
		m.runJob(ctx, j)
	}

	if len(jobs) > 0 {
		m.TickAccrual(ctx)
	}
}

// move changes the counts of a feed.
func (m *Module) move(id string, queued, running int) {
	m.runsMu.Lock()
	defer m.runsMu.Unlock()

	j := m.jobOf(id)
	j.queued += queued
	j.running += running
}

// jobOf is the counts of a feed; the caller holds runsMu.
func (m *Module) jobOf(id string) *feedJobs {
	if m.jobs[id] == nil {
		m.jobs[id] = &feedJobs{}
	}

	return m.jobs[id]
}

// activity is what the process does with a feed now; the caller holds runsMu.
func (m *Module) activity(id string) string {
	switch j := m.jobOf(id); {
	case j.running > 0:
		return domain.ActivityRunning
	case j.queued > 0:
		return domain.ActivityQueued
	}

	return domain.ActivityIdle
}
