// Package b3consolidated reads the consolidated trades file the B3 publishes for each trading
// day (TradeInformationConsolidatedFile). It covers every segment, the fixed income ETFs that
// COTAHIST omits included.
package b3consolidated

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/b3cotahist"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const fileName = "TradeInformationConsolidatedFile"

var errNotFinal = errors.New("file not final")

type Source struct {
	client  *http.Client
	baseURL string
	years   b3cotahist.Source
	list    *feed.ListCache
}

// New returns the source; years reads the COTAHIST year files of a range over 31 days.
func New(c *http.Client, baseURL string, years b3cotahist.Source) Source {
	return Source{
		client:  c,
		baseURL: strings.TrimSuffix(baseURL, "/"),
		years:   years,
		list:    feed.NewListCache(time.Now),
	}
}

func (Source) ID() string { return "b3_consolidated" }

// Codes returns the instruments listed on the B3 and quoted in BRL.
func (Source) Codes(ins []feed.Instrument) []money.Currency {
	var out []money.Currency
	for _, in := range ins {
		if in.Exchange == "BVMF" && in.QuoteCurrency == "BRL" {
			out = append(out, in.Code)
		}
	}

	return out
}

// Fetch returns the last trade price (in BRL) of each code for each weekday of [from, to]. A range
// over 31 days reads the COTAHIST year files first, then the daily files from the day after the
// latest year-file record (D14). A day without a file is skipped. A file not yet final ends the run without a failure, so the next
// tick fetches its day again. The first failing day ends the run: its failure, a
// feed.ScopeError, is returned with the quotes of the earlier days.
func (c Source) Fetch(
	ctx context.Context,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	want := make(map[string]bool, len(codes))
	for _, code := range codes {
		want[string(code)] = true
	}

	var out []feed.Quote

	dayFrom := from

	if from.Before(to.AddDate(0, 0, -31)) {
		years, latest, err := c.years.FetchYears(ctx, codes, from, to)
		if err != nil {
			return years, err
		}

		out = years
		dayFrom = to.AddDate(0, 0, -30)

		if next := latest.AddDate(0, 0, 1); !latest.IsZero() && next.After(dayFrom) {
			dayFrom = next
		}

		if from.After(dayFrom) {
			dayFrom = from
		}
	}

	for d := dayFrom; !d.After(to); d = d.AddDate(0, 0, 1) {
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}

		quotes, err := c.fetchDay(ctx, d, want)
		switch {
		case errors.Is(err, feed.ErrNoData):
			continue
		case errors.Is(err, errNotFinal):
			return out, nil
		case err != nil:
			return out, &feed.ScopeError{Key: "day", Value: d.Format(time.DateOnly), Err: err}
		}

		out = append(out, quotes...)
	}

	return out, nil
}

// Search matches the tickers of the latest file a fetch parsed; it never fetches (plan 3 D5).
func (c Source) Search(_ context.Context, query string, limit int) ([]feed.Listing, error) {
	return feed.MatchListings(c.list.Last(), query, limit), nil
}

// fetchDay downloads the file of day in two steps: a request by name returns a token, the token
// returns the file.
func (c Source) fetchDay(
	ctx context.Context,
	day time.Time,
	want map[string]bool,
) ([]feed.Quote, error) {
	date := day.Format(time.DateOnly)
	body, err := feed.Get(
		ctx,
		c.client,
		c.baseURL+"/api/download/requestname?fileName="+fileName+"&date="+date+"&recaptchaToken=",
	)
	// The B3 answers 400 for a day without a file: a weekend, a holiday or a day not yet
	// published. A renamed file answers 400 too; the feed then turns stale (ADR 025 F9).
	var status *feed.StatusError
	if errors.As(err, &status) && status.Code == http.StatusBadRequest {
		return nil, feed.ErrNoData
	}

	if err != nil {
		return nil, fmt.Errorf("request the file: %w", err)
	}

	var ticket struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(body, &ticket); err != nil {
		return nil, fmt.Errorf("read the download token: %w", err)
	}

	if ticket.Token == "" {
		return nil, errors.New("read the download token: empty")
	}

	body, err = feed.Get(
		ctx,
		c.client,
		c.baseURL+"/api/download/?token="+url.QueryEscape(ticket.Token),
	)
	if err != nil {
		return nil, fmt.Errorf("download the file: %w", err)
	}

	quotes, listings, err := parse(string(body), day, want)
	if err != nil {
		return nil, err
	}

	c.list.Set(listings)

	return quotes, nil
}

// parse reads a file: a status line, a header naming the columns, one line per ticker. It returns
// the quotes of the wanted tickers and a listing for each CASH ticker with a last price. A malformed
// file returns an error and no quote.
func parse(body string, day time.Time, want map[string]bool) ([]feed.Quote, []feed.Listing, error) {
	lines := strings.Split(strings.TrimRight(body, "\r\n"), "\n")
	for i := range lines {
		lines[i] = strings.TrimSuffix(lines[i], "\r")
	}

	status, ok := strings.CutPrefix(lines[0], "Status do Arquivo: ")
	if !ok || len(lines) < 2 {
		return nil, nil, fmt.Errorf("line 1: %q is not a file status", lines[0])
	}

	if status != "Final" {
		return nil, nil, errNotFinal
	}

	header := strings.Split(lines[1], ";")

	cols, err := readColumns(header)
	if err != nil {
		return nil, nil, err
	}

	return readRecords(lines[2:], len(header), cols, day, want)
}

// columns holds the index of each column the parser reads.
type columns struct {
	date, ticker, price, segment int
	hasSegment                   bool
}

func readColumns(header []string) (columns, error) {
	index := make(map[string]int, len(header))
	for i, name := range header {
		index[name] = i
	}

	dateCol, okDate := index["RptDt"]
	tickerCol, okTicker := index["TckrSymb"]

	priceCol, okPrice := index["LastPric"]
	segmentCol, okSegment := index["SgmtNm"]

	if !okDate || !okTicker || !okPrice {
		return columns{}, errors.New("line 2: the header lacks RptDt, TckrSymb or LastPric")
	}

	return columns{
		date:       dateCol,
		ticker:     tickerCol,
		price:      priceCol,
		segment:    segmentCol,
		hasSegment: okSegment,
	}, nil
}

func readRecords(
	lines []string,
	fields int,
	cols columns,
	day time.Time,
	want map[string]bool,
) ([]feed.Quote, []feed.Listing, error) {
	date := day.Format(time.DateOnly)
	seen := make(map[string]bool)

	var (
		out      []feed.Quote
		listings []feed.Listing
	)

	for i, line := range lines {
		n := i + 3

		rec := strings.Split(line, ";")
		if len(rec) != fields {
			return nil, nil, fmt.Errorf("line %d: %d fields, want %d", n, len(rec), fields)
		}

		if rec[cols.date] != date {
			return nil, nil, fmt.Errorf("line %d: not a record of %s", n, date)
		}

		ticker := rec[cols.ticker]

		if l, ok := cashListing(rec, cols); ok {
			listings = append(listings, l)
		}

		// An instrument without a trade on the day, such as an untraded option, has no last price.
		if !want[ticker] || rec[cols.price] == "" {
			continue
		}

		if seen[ticker] {
			return nil, nil, fmt.Errorf("line %d: %s appears twice", n, ticker)
		}

		seen[ticker] = true

		q, err := lastQuote(rec[cols.price], ticker, day)
		if err != nil {
			return nil, nil, fmt.Errorf("line %d: %w", n, err)
		}

		out = append(out, q)
	}

	return out, listings, nil
}

func cashListing(rec []string, cols columns) (feed.Listing, bool) {
	if !cols.hasSegment || rec[cols.segment] != "CASH" || rec[cols.price] == "" {
		return feed.Listing{}, false
	}

	return feed.Listing{
		Code:          money.Currency(rec[cols.ticker]),
		Exchange:      "BVMF",
		QuoteCurrency: "BRL",
	}, true
}

func lastQuote(price, ticker string, day time.Time) (feed.Quote, error) {
	// The file writes a decimal comma and no thousands separator.
	value, err := money.ParseRate(strings.Replace(price, ",", ".", 1))
	if err != nil {
		return feed.Quote{}, err
	}

	return feed.Quote{
		Instrument: money.Currency(ticker),
		Quote:      "BRL",
		Date:       day,
		Value:      value,
	}, nil
}
