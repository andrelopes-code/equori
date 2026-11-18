package toolapi

import (
	"context"
	"strconv"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type pricePointIn struct {
	Date  tool.Date `json:"date"  jsonschema:"date of the price"`
	Value string    `json:"value" jsonschema:"positive decimal price of one unit"`
}

type recordPriceSeriesIn struct {
	Code   string         `json:"code"   jsonschema:"instrument code, such as a ticker"`
	Quote  string         `json:"quote"  jsonschema:"code of the currency the prices are quoted in"`
	Prices []pricePointIn `json:"prices" jsonschema:"the series, one price per date"`
}

type recordPriceSeriesOut struct {
	New       int `json:"new"`
	Replaced  int `json:"replaced"   jsonschema:"dates whose typed price changed"`
	Unchanged int `json:"unchanged"`
	BelowFeed int `json:"below_feed" jsonschema:"dates stored but not used, because a price source already gives that date"`
}

func recordPriceSeries(svc Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_price_series",
		Description: "Proposes a series of prices of one instrument, typed by the user or read from a statement, all or nothing. " +
			"A price of a date already typed is replaced; a date a price source covers keeps the price of the source. " +
			"Use it for more than one date, such as the history of a fund or of a fixed income contract. " +
			"Do not use it for one price: manage_instrument record_price does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in recordPriceSeriesIn) (tool.Preview, error) {
		counts, err := runPriceSeries(ctx, svc, booksID, in, true)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{
			Action: "record_price_series",
			Target: in.Code,
			Changes: []tool.Change{{
				Field: "count",
				After: tool.TextValue(strconv.Itoa(counts.New + counts.Replaced)),
			}},
		}, nil
	}, func(ctx context.Context, booksID int64, in recordPriceSeriesIn) (recordPriceSeriesOut, error) {
		counts, err := runPriceSeries(ctx, svc, booksID, in, false)

		return recordPriceSeriesOut(counts), err
	})
}

func runPriceSeries(
	ctx context.Context,
	svc Service,
	booksID int64,
	in recordPriceSeriesIn,
	dryRun bool,
) (domain.PriceCounts, error) {
	if _, err := visibleInstrument(ctx, svc, booksID, in.Code); err != nil {
		return domain.PriceCounts{}, err
	}

	points := make([]domain.PricePoint, len(in.Prices))
	for i, p := range in.Prices {
		value, err := money.ParseRate(p.Value)
		if err != nil {
			return domain.PriceCounts{}, tool.InvalidArgument(
				"prices["+strconv.Itoa(i)+"].value",
				"must be a positive decimal with at most 12 decimals",
			)
		}

		points[i] = domain.PricePoint{Date: p.Date.Time, Value: value}
	}

	return svc.RecordInstrumentPrices(ctx, in.Code, money.Currency(in.Quote), points, dryRun)
}
