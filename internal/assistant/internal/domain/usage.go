package domain

import (
	"strings"
	"time"
	"unicode/utf8"
)

// UsageEntry is one attempt to add to the day's counters (ADR 019 U2).
type UsageEntry struct {
	UserID       int64
	Day          time.Time
	ProviderID   string
	Model        string
	UseID        string
	Failed       bool
	Quota        bool
	InputTokens  int64
	OutputTokens int64
	CoolingUntil time.Time
}

// UsageSummary is the usage of one provider and model: today and since the period's start.
type UsageSummary struct {
	ProviderID     string
	Model          string
	TodayRequests  int64
	TodayErrors    int64
	TodayTokens    int64
	PeriodRequests int64
	PeriodTokens   int64
	// CoolingUntil is zero when no attempt of the period cooled the model down.
	CoolingUntil time.Time
}

// Limit is the daily quota the owner declared for a provider and model; nil is no limit.
type Limit struct {
	ProviderID     string
	Model          string
	RequestsPerDay *int64
	TokensPerDay   *int64
}

const maxProviderIDLength = 60

func NewLimit(providerID, model string, requests, tokens *int64) (Limit, error) {
	model = strings.TrimSpace(model)
	if providerID == "" || utf8.RuneCountInString(providerID) > maxProviderIDLength {
		return Limit{}, invalid("provider_id", "must have 1 to 60 characters")
	}
	if model == "" || utf8.RuneCountInString(model) > maxModelLength {
		return Limit{}, invalid("model", "must have 1 to 200 characters")
	}
	if requests != nil && (*requests < 1 || *requests > 1<<31-1) {
		return Limit{}, invalid("requests_per_day", "must be a positive integer")
	}
	if tokens != nil && *tokens < 1 {
		return Limit{}, invalid("tokens_per_day", "must be a positive integer")
	}
	return Limit{ProviderID: providerID, Model: model, RequestsPerDay: requests, TokensPerDay: tokens}, nil
}

// Cleared reports a limit with neither quota, which removes the stored one.
func (l Limit) Cleared() bool { return l.RequestsPerDay == nil && l.TokensPerDay == nil }
