package b3pricereport

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	// DefaultURL is the site of the B3; listedURL is the host of its pages of listed companies.
	DefaultURL = "https://www.b3.com.br"
	listedURL  = "https://sistemaswebb3-listados.b3.com.br"
	listedPath = "/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/"
)

// tradingCode is a B3 code: the four characters of the issuer and the number of the class.
var tradingCode = regexp.MustCompile(`^([A-Z0-9]{4})([0-9]{1,2})$`)

// shareClasses are the codes an ISIN holds for the number of a share class.
var shareClasses = map[string]string{"3": "ACNOR", "4": "ACNPR", "5": "ACNPA", "6": "ACNPB"}

// stockEvent is one event of the page of an issuer, "DESDOBRAMENTO" of "900,00000000000" percent.
type stockEvent struct {
	ISIN      string `json:"isinCode"`
	Label     string `json:"label"`
	Factor    string `json:"factor"`
	LastPrior string `json:"lastDatePrior"`
}

// Splits returns the splits of each code of ins that the page of its issuer states, one request per
// issuer (A266 SA2). A 429 answer ends it; any other failure is joined while the next one still runs.
func (s Source) Splits(ctx context.Context, ins []feed.Instrument) ([]feed.Split, error) {
	var (
		out  []feed.Split
		errs []error
	)

	byIssuer := make(map[string][]string)

	for _, code := range s.Codes(ins) {
		if m := tradingCode.FindStringSubmatch(string(code)); m != nil {
			byIssuer[m[1]] = append(byIssuer[m[1]], m[2])
		}
	}

	for issuer, classes := range byIssuer {
		events, err := s.eventsOf(ctx, issuer)

		var status *feed.StatusError
		if errors.As(err, &status) && status.Code == http.StatusTooManyRequests {
			return out, errors.Join(append(errs, err)...)
		}

		if err != nil {
			errs = append(errs, &feed.ScopeError{Key: "issuer", Value: issuer, Err: err})
			continue
		}

		for _, class := range classes {
			out = append(out, splitsOf(money.Currency(issuer+class), class, events)...)
		}
	}

	return out, errors.Join(errs...)
}

// eventsOf reads the stock events of an issuer; an unknown one has none.
func (s Source) eventsOf(ctx context.Context, issuer string) ([]stockEvent, error) {
	query, err := json.Marshal(map[string]string{"issuingCompany": issuer, "language": "pt-br"})
	if err != nil {
		return nil, err
	}

	base := s.baseURL
	if base == DefaultURL {
		base = listedURL
	}

	body, err := feed.Get(
		ctx,
		s.client,
		base+listedPath+base64.StdEncoding.EncodeToString(query),
	)
	if errors.Is(err, feed.ErrNoData) || err == nil && len(body) == 0 {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	// The page answers its JSON inside a JSON string.
	var text string
	if json.Unmarshal(body, &text) == nil {
		body = []byte(text)
	}

	var answer []struct {
		Events []stockEvent `json:"stockDividends"`
	}
	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode the events: %w", err)
	}

	var out []stockEvent
	for _, a := range answer {
		out = append(out, a.Events...)
	}

	return out, nil
}

// splitsOf are the splits of one class of an issuer: the events of one day multiply, and a day whose
// events cancel out is no split.
func splitsOf(code money.Currency, class string, events []stockEvent) []feed.Split {
	byDay := make(map[time.Time]*big.Rat)

	for _, e := range events {
		if !ofClass(e.ISIN, class) {
			continue
		}

		ratio, ok := ratioOf(e)
		day, err := time.Parse("02/01/2006", e.LastPrior)

		if !ok || err != nil {
			continue
		}

		first := day.AddDate(0, 0, 1)
		if byDay[first] == nil {
			byDay[first] = big.NewRat(1, 1)
		}

		byDay[first].Mul(byDay[first], ratio)
	}

	var out []feed.Split

	for day, ratio := range byDay {
		if ratio.Cmp(big.NewRat(1, 1)) != 0 {
			out = append(out, feed.Split{Instrument: code, Date: day, Ratio: ratio})
		}
	}

	return out
}

// ofClass reports whether an ISIN is of the class of a code: a share by its class, any other suffix by
// an ISIN that is not of a share.
func ofClass(isin, class string) bool {
	if want, ok := shareClasses[class]; ok {
		return strings.Contains(isin, want)
	}

	return !strings.Contains(isin, "ACN")
}

// ratioOf is the units after an event for each unit before it; false for an event that is no split.
func ratioOf(e stockEvent) (*big.Rat, bool) {
	text := strings.ReplaceAll(strings.ReplaceAll(e.Factor, ".", ""), ",", ".")

	factor, ok := new(big.Rat).SetString(text)
	if !ok || factor.Sign() <= 0 {
		return nil, false
	}

	switch e.Label {
	case "DESDOBRAMENTO", "BONIFICACAO":
		factor.Quo(factor, big.NewRat(100, 1))

		return factor.Add(factor, big.NewRat(1, 1)), true
	case "GRUPAMENTO":
		return factor, true
	}

	return nil, false
}
