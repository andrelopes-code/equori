package marketdata

import (
	"regexp"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// euroArea lists the members of the euro area on 2026-01-01.
var euroArea = []string{
	"AT",
	"BE",
	"BG",
	"CY",
	"DE",
	"EE",
	"ES",
	"FI",
	"FR",
	"GR",
	"HR",
	"IE",
	"IT",
	"LT",
	"LU",
	"LV",
	"MT",
	"NL",
	"PT",
	"SI",
	"SK",
}

// oddLotExchanges are the exchanges with an odd-lot market whose codes RoundLotCode maps.
var oddLotExchanges = []string{"BVMF"}

// bvmfOddLot is the B3 odd-lot code: the round-lot code with a final F.
var bvmfOddLot = regexp.MustCompile(`^([A-Z0-9]{4}[0-9]{1,2})F$`)

// bvmfT2 is the first trade date settled in two business days (B3 project D+2, 2019-05-27).
var bvmfT2 = time.Date(2019, time.May, 27, 0, 0, 0, 0, time.UTC)

// neutralCalendar is the calendar of a region without a banking calendar: weekends only.
const neutralCalendar = "weekend"

// DefaultCalendar returns the calendar a record takes when the owner's region is region.
func (m *Module) DefaultCalendar(region string) string {
	if region == "BR" {
		return CalendarBRBanking
	}

	return neutralCalendar
}

// SuggestedFeeds names the feeds suggested to a book of region (ADR 025 F3); a suggestion
// enables nothing.
func SuggestedFeeds(region string) []string {
	switch {
	case region == "BR":
		return []string{
			"b3_consolidated",
			"b3_price_report",
			"bcb_ptax",
			"tesouro_direto",
			"cvm_funds",
			"br_cdi",
			"br_ipca",
			"br_selic",
			"br_igpm",
			"br_ptax_usd",
			"br_ibovespa",
			"br_ifix",
			"br_focus",
			"br_focus_ipca",
			"br_ifdata",
			"br_tesouro",
			"br_cvm_fii",
			"br_cvm_cia",
		}
	case region == "US":
		return []string{"us_sofr", "us_cpi"}
	case slices.Contains(euroArea, region):
		return []string{"ecb", "eu_estr", "ea_hicp"}
	}

	return nil
}

// RoundLotCode returns the round-lot code of an odd-lot code of exchange mic (A228 IO3).
func RoundLotCode(mic, code string) (string, bool) {
	if mic != "BVMF" {
		return "", false
	}

	match := bvmfOddLot.FindStringSubmatch(code)
	if match == nil {
		return "", false
	}

	return match[1], true
}

// sessionIndex returns the index whose dates are the sessions of in and the currency its prices are
// in (A265 PH3); empty for an instrument without one.
func sessionIndex(in feed.Instrument) (string, money.Currency) {
	if in.Type == "currency" {
		if in.Code == "BRL" {
			return "", ""
		}

		return "usd_brl", "BRL"
	}

	switch in.Exchange {
	case "BVMF":
		return "ibovespa", in.QuoteCurrency
	case "XNYS", "XNAS", "ARCX", "BATS", "XASE":
		return "sp500", in.QuoteCurrency
	}

	return "", ""
}

// SettlementCycle returns the business days after the trade date on which a trade of exchange
// mic made on date settles, and the calendar that counts them (A228 IO7); ok is false for an
// exchange without a cycle.
func SettlementCycle(mic string, date time.Time) (int, string, bool) {
	if mic != "BVMF" {
		return 0, "", false
	}

	if date.Before(bvmfT2) {
		return 3, CalendarBRBanking, true
	}

	return 2, CalendarBRBanking, true
}

// MinimumRedemption is the first day a new security of subtype may be redeemed under the rule of
// region on its issue date; zero when the region sets none. In Brazil an LCI or an LCA without a
// price index waits 6 months from 2025-08-01 (Resolução CMN 5.215/2025), 12 months (LCI) or 9
// months (LCA) from 2024-02-02 (Resolução CMN 5.119/2024) and 90 days before; an LCI updated by a
// price index waits 36 months from 2024-02-02. An LCA updated by a price index has no figure the
// sources state, so it takes none (coverage row F-07). An LF, senior or subordinated, and a DPGE
// redeem at maturesOn only (Lei 12.249/2010 art. 38, Resolução CMN 5.007/2022 art. 5; the DPGE
// rule of the FGC; coverage row F-10).
func MinimumRedemption(region, subtype, indexID string, issuedOn, maturesOn time.Time) time.Time {
	if region == "BR" && (subtype == "lf" || subtype == "lf_subordinated" || subtype == "dpge") {
		return maturesOn
	}

	if region != "BR" || (subtype != "lci" && subtype != "lca") || issuedOn.IsZero() {
		return time.Time{}
	}

	priceIndex := indexID == "ipca" || indexID == "igpm"
	reformed := !issuedOn.Before(time.Date(2024, time.February, 2, 0, 0, 0, 0, time.UTC))

	switch {
	case !reformed:
		return issuedOn.AddDate(0, 0, 90)
	case priceIndex && subtype == "lci":
		return issuedOn.AddDate(0, 36, 0)
	case priceIndex:
		return time.Time{}
	case !issuedOn.Before(time.Date(2025, time.August, 1, 0, 0, 0, 0, time.UTC)):
		return issuedOn.AddDate(0, 6, 0)
	case subtype == "lci":
		return issuedOn.AddDate(0, 12, 0)
	}

	return issuedOn.AddDate(0, 9, 0)
}
