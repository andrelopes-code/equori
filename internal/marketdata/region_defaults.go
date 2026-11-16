package marketdata

import (
	"regexp"
	"slices"
	"time"
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

// DefaultCalendar returns the calendar a record takes when the owner's region is region.
func (m *Module) DefaultCalendar(region string) string {
	if region == "BR" {
		return CalendarBRBanking
	}

	return "weekend"
}

// SuggestedFeeds names the feeds suggested to a book of region (ADR 025 F3); a suggestion
// enables nothing.
func SuggestedFeeds(region string) []string {
	switch {
	case region == "BR":
		return []string{
			"b3_consolidated",
			"bcb_ptax",
			"tesouro_direto",
			"cvm_funds",
			"br_cdi",
			"br_ipca",
			"br_focus",
			"br_ifdata",
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
