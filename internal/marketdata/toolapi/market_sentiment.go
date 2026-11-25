package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// sentimentID is the sentiment index the view returns.
const sentimentID = "crypto_fear_greed"

type sentimentView struct {
	ID      string    `json:"id"`
	Enabled bool      `json:"enabled"`
	Value   int       `json:"value"`
	Date    tool.Date `json:"date,omitzero"`
	Since   tool.Date `json:"since,omitzero"`
	Days    int       `json:"days"`
	// DaysToValue counts the stored days at the value or below it.
	DaysToValue int `json:"days_to_value"`
}

func marketSentiment(ctx context.Context, svc Service) (getMarketDataOut, error) {
	x, err := svc.Sentiment(ctx, sentimentID)
	if err != nil {
		return getMarketDataOut{}, err
	}

	return getMarketDataOut{Sentiment: toSentimentView(x)}, nil
}

// toSentimentView leaves the date out when no value is stored.
func toSentimentView(x domain.SentimentIndex) sentimentView {
	v := sentimentView{ID: x.ID, Enabled: x.Enabled, Days: x.Days}
	if x.Since != nil {
		v.Since = tool.DateOf(*x.Since)
	}

	if x.Latest == nil {
		return v
	}

	v.Value = x.Latest.Value
	v.Date = tool.DateOf(x.Latest.Date)

	for _, n := range x.Counts[:x.Latest.Value+1] {
		v.DaysToValue += n
	}

	return v
}
