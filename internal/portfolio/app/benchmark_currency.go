package app

import (
	"context"
	"errors"
	"time"
)

// inReportCurrency returns the rates of index in the currency of the report: as they are, or
// converted through the exchange index of the two currencies; false without one (R15, A265 MI8).
func (s *Service) inReportCurrency(
	ctx context.Context,
	p period,
	index string,
	rates []IndexRate,
) ([]IndexRate, bool, error) {
	if s.inIndexCurrency(index, p.report) {
		return rates, true, nil
	}

	id := s.md.ExchangeIndex(s.md.IndexCurrency(index), p.report.Opening.Currency())
	if id == "" {
		return nil, false, nil
	}

	exchange, err := s.md.IndexRates(ctx, id, p.from.AddDate(0, 0, -1), p.to)
	if errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotDaily) {
		return nil, false, nil
	}

	if err != nil {
		return nil, false, err
	}

	return convertedRates(p.from, rates, exchange), true, nil
}

// convertedRates returns the rate of each day that holds a rate of the index or of the exchange,
// (1 + index)(1 + exchange) − 1, up to the last rate of the index. An index that starts after the
// period, by more than a closure, takes the exchange from its first rate on.
func convertedRates(from time.Time, rates, exchange []IndexRate) []IndexRate {
	if len(rates) == 0 {
		return nil
	}

	first, last := rates[0].Date, rates[len(rates)-1].Date
	late := first.Sub(from) > maxRateGap*24*time.Hour

	out := make([]IndexRate, 0, len(rates)+len(exchange))
	i := 0

	for _, x := range exchange {
		if x.Date.After(last) || late && x.Date.Before(first) {
			continue
		}

		for ; i < len(rates) && rates[i].Date.Before(x.Date); i++ {
			out = append(out, rates[i])
		}

		if i < len(rates) && rates[i].Date.Equal(x.Date) {
			x.Rate = (1+rates[i].Rate)*(1+x.Rate) - 1
			i++
		}

		out = append(out, x)
	}

	return append(out, rates[i:]...)
}
