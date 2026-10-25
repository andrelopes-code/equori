// Command demoseed fills a second user of a running instance with 24 months of realistic personal-finance data.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"os"
	"os/signal"
	"time"
	_ "time/tzdata" // the default history ends on the current date in São Paulo.
)

const historyMonths = 24

type config struct {
	url, email, password string
	today                time.Time
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "demoseed:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("demoseed", flag.ContinueOnError)
	cfg := config{}
	today := fs.String("today", "", "last day of the history, YYYY-MM-DD; default the current date in São Paulo")
	fs.StringVar(&cfg.url, "url", "http://127.0.0.1:8080", "address of the running application")
	fs.StringVar(&cfg.email, "email", "demo@equori.local", "email of the demo user")
	fs.StringVar(&cfg.password, "password", os.Getenv("EQUORI_DEMO_PASSWORD"), "password of the demo user; default $EQUORI_DEMO_PASSWORD")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if cfg.password == "" {
		return errors.New("a password is required: set -password or EQUORI_DEMO_PASSWORD")
	}
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return fmt.Errorf("load location: %w", err)
	}
	cfg.today = time.Now().In(loc)
	if *today != "" {
		if cfg.today, err = time.Parse(time.DateOnly, *today); err != nil {
			return fmt.Errorf("-today: %w", err)
		}
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("cookie jar: %w", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	s := newSeeder(ctx, cfg.url, &http.Client{Jar: jar, Timeout: time.Minute})
	s.login(cfg.email, cfg.password)
	if err := seed(s, cfg); err != nil {
		return err
	}
	// Classification reads the transactions from the outbox, which the running application drains in the background.
	time.Sleep(5 * time.Second)
	if err := s.runRules(); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "seeded %s with %d requests\n", cfg.email, s.calls)
	return nil
}

// seed runs every stage in order on an authenticated seeder.
func seed(s *seeder, cfg config) error {
	s.start = firstOfMonth(cfg.today).AddDate(0, -historyMonths, 0)
	s.today = cfg.today
	start := iso(s.start)
	s.loadSystemAccounts()
	s.requireEmpty()
	s.localizeSystemAccounts()
	s.buildChart(start)
	s.buildInvestments(start)
	s.openBalances(start)
	s.postPrices()
	s.buildSchedules()
	s.buildBudgets()
	s.buildRules()
	s.cashflow()
	s.runEvents()
	s.assertBalances()
	s.reconcileStatements()
	s.importStatements()
	s.importCSV()
	s.touchOccurrences()
	s.goals()
	return s.err
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}
