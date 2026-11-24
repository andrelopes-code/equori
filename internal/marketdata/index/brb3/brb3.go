// Package brb3 reads the daily closes of the indexes of the B3 from the statistics of its site.
package brb3

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
)

const (
	path = "/indexStatisticsProxy/IndexCall/GetPortfolioDay/"
	// reachDays reaches the session before the first day asked, which its change needs: the longest
	// closure of the B3 is shorter.
	reachDays = 15
	// closedHour is the hour in São Paulo from which the value of the day is taken as its close.
	closedHour = 19
	timeZone   = "America/Sao_Paulo"
)

// Source is one index of the B3 seen as a daily index source.
type Source struct {
	hc    *http.Client
	base  string
	id    string
	index string
	// name is the code the site knows the index by.
	name string
	now  func() time.Time
}

// Ibovespa is the Índice Bovespa (identifier br_ibovespa, index ibovespa), a total return index of
// the B3: the distributions of its shares are reinvested.
func Ibovespa(hc *http.Client, base string, now func() time.Time) Source {
	return Source{
		hc:    hc,
		base:  base,
		id:    "br_ibovespa",
		index: "ibovespa",
		name:  "IBOVESPA",
		now:   now,
	}
}

// IFIX is the index of listed real estate funds (identifier br_ifix, index ifix), a total return
// index.
func IFIX(hc *http.Client, base string, now func() time.Time) Source {
	return Source{hc: hc, base: base, id: "br_ifix", index: "ifix", name: "IFIX", now: now}
}

func (s Source) ID() string     { return s.id }
func (s Source) Index() string  { return s.index }
func (s Source) Period() string { return index.PeriodDay }
func (s Source) Kind() string   { return index.KindMarket }

// Fetch returns the change of each session of [from, to] from the session before it. A past year
// without a session, after a year that holds one, is a failure.
func (s Source) Fetch(ctx context.Context, from, to time.Time) ([]index.Rate, error) {
	var levels []index.Level

	start := from.AddDate(0, 0, -reachDays)

	for year := start.Year(); year <= to.Year(); year++ {
		got, err := s.year(ctx, year)
		if err != nil {
			return nil, fmt.Errorf("%s: %d: %w", s.id, year, err)
		}

		if len(got) == 0 && len(levels) > 0 && year < s.now().Year() {
			return nil, fmt.Errorf("%s: no session in %d", s.id, year)
		}

		levels = append(levels, got...)
	}

	levels, err := s.finished(levels, to)
	if err != nil {
		return nil, err
	}

	rates, err := index.Changes(levels, from)
	if err != nil {
		return rates, fmt.Errorf("%s: %w", s.id, err)
	}

	return rates, nil
}

// year reads the closes of one year, oldest first.
func (s Source) year(ctx context.Context, year int) ([]index.Level, error) {
	query, err := json.Marshal(map[string]string{
		"index":    s.name,
		"language": "pt-br",
		"year":     strconv.Itoa(year),
	})
	if err != nil {
		return nil, err
	}

	body, err := feed.Get(ctx, s.hc, s.base+path+base64.StdEncoding.EncodeToString(query))
	if err != nil {
		return nil, err
	}

	return parse(body, year)
}

// parse reads an answer: one row per day of the month, its column rateValueN the close of that day
// in month N, null without a session.
func parse(body []byte, year int) ([]index.Level, error) {
	var answer struct {
		Results []map[string]any `json:"results"`
	}
	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	var out []index.Level

	for _, row := range answer.Results {
		day, ok := row["day"].(float64)
		if !ok {
			return nil, fmt.Errorf("day %v is not a number", row["day"])
		}

		for month := time.January; month <= time.December; month++ {
			text, ok := row["rateValue"+strconv.Itoa(int(month))].(string)
			if !ok || text == "" {
				continue
			}

			level, err := levelOf(year, month, int(day), text)
			if err != nil {
				return nil, err
			}

			out = append(out, level)
		}
	}

	slices.SortFunc(out, func(a, b index.Level) int { return a.Date.Compare(b.Date) })

	return out, nil
}

// levelOf reads a close as the site writes it: "160.538,69".
func levelOf(year int, month time.Month, day int, text string) (index.Level, error) {
	date := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	if date.Month() != month {
		return index.Level{}, fmt.Errorf("day %d is not in %s", day, month)
	}

	value := strings.ReplaceAll(strings.ReplaceAll(text, ".", ""), ",", ".")
	if v, err := strconv.ParseFloat(value, 64); err != nil || v <= 0 {
		return index.Level{}, fmt.Errorf(
			"close %q of %s is not a positive decimal",
			text,
			date.Format(time.DateOnly),
		)
	}

	return index.Level{Date: date, Value: value}, nil
}

// finished keeps the levels up to to whose session is over.
func (s Source) finished(levels []index.Level, to time.Time) ([]index.Level, error) {
	loc, err := time.LoadLocation(timeZone)
	if err != nil {
		return nil, fmt.Errorf("%s: load time zone: %w", s.id, err)
	}

	now := s.now().In(loc)

	last := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if now.Hour() < closedHour {
		last = last.AddDate(0, 0, -1)
	}

	if to.Before(last) {
		last = to
	}

	return slices.DeleteFunc(levels, func(l index.Level) bool { return l.Date.After(last) }), nil
}
