package apitest

import (
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Profile is the language, region and base currency of the owner of New (feature-design.md X2).
type Profile struct {
	Name   string
	Locale locale.Locale
	Base   money.Currency
}

// Brazil is the profile of Login.
func Brazil() Profile {
	return Profile{Name: "brazil", Locale: locale.Locale{Language: "pt", Region: "BR"}, Base: "BRL"}
}

// Neutral is a region that no region default, registry or web switch names: every regional value
// is the neutral one.
func Neutral() Profile {
	return Profile{Name: "neutral", Locale: locale.Locale{Language: "en", Region: "NZ"}, Base: "NZD"}
}

// ForeignBase is Brazil with a base currency other than BRL.
func ForeignBase() Profile {
	return Profile{Name: "foreign_base", Locale: locale.Locale{Language: "pt", Region: "BR"}, Base: "USD"}
}

// Profiles are the profiles a scenario that holds amounts runs in.
func Profiles() []Profile { return []Profile{Brazil(), Neutral(), ForeignBase()} }

// As makes the owner of New a member of profile p.
func As(p Profile) Option { return func(o *options) { o.profile = p } }

// Money is an amount in the base currency of the harness profile.
func (h *Harness) Money(amount int64) map[string]any {
	return map[string]any{"amount": amount, "currency": string(h.Profile.Base)}
}

// Posting is apitest.Posting in the base currency of the harness profile.
func (h *Harness) Posting(account string, amount int64) map[string]any {
	return map[string]any{"account_id": account, "amount": h.Money(amount)}
}
