package domain

import (
	"regexp"
	"strconv"
	"time"
)

var (
	dayMonth  = regexp.MustCompile(`^([0-9]{1,2})/([0-9]{1,2})(?:/([0-9]{2}|[0-9]{4}))?$`)
	isoDate   = regexp.MustCompile(`^([0-9]{4})-([0-9]{2})-([0-9]{2})$`)
	dayNumber = regexp.MustCompile(`^[0-9]{1,2}$`)
)

// datePhrase is a date read from text; valid is false for a day its month does not have.
type datePhrase struct {
	date  time.Time
	valid bool
	words int
}

// readDate reads the date phrase of A109 that starts at free word i; today is a UTC midnight.
func readDate(ws []word, i int, today time.Time, lex Lexicon) (datePhrase, bool) {
	n := ws[i].norm
	if back, ok := lex.DaysBack[n]; ok {
		return datePhrase{date: today.AddDate(0, 0, -back), valid: true, words: 1}, true
	}
	if wd, ok := lex.Weekdays[n]; ok {
		back := (int(today.Weekday()) - int(wd) + 7) % 7
		return datePhrase{date: today.AddDate(0, 0, -back), valid: true, words: 1}, true
	}
	if n == "dia" && i+1 < len(ws) && ws[i+1].free() && dayNumber.MatchString(ws[i+1].norm) {
		d := atoi(ws[i+1].norm)
		y, m := today.Year(), int(today.Month())
		if d > today.Day() {
			if m--; m == 0 {
				y, m = y-1, 12
			}
		}
		date, ok := dateOf(y, m, d)
		return datePhrase{date: date, valid: ok, words: 2}, true
	}
	if g := dayMonth.FindStringSubmatch(n); g != nil {
		d, m := atoi(g[1]), atoi(g[2])
		switch len(g[3]) {
		case 2:
			date, ok := dateOf(2000+atoi(g[3]), m, d)
			return datePhrase{date: date, valid: ok, words: 1}, true
		case 4:
			date, ok := dateOf(atoi(g[3]), m, d)
			return datePhrase{date: date, valid: ok, words: 1}, true
		}
		date, ok := dateOf(today.Year(), m, d)
		if ok && date.After(today) {
			date, ok = dateOf(today.Year()-1, m, d)
		}
		return datePhrase{date: date, valid: ok, words: 1}, true
	}
	if g := isoDate.FindStringSubmatch(n); g != nil {
		date, ok := dateOf(atoi(g[1]), atoi(g[2]), atoi(g[3]))
		return datePhrase{date: date, valid: ok, words: 1}, true
	}
	return datePhrase{}, false
}

// dateOf returns the date and false when the month or the day does not exist.
func dateOf(y, m, d int) (time.Time, bool) {
	if d < 1 || d > 31 || m < 1 || m > 12 {
		return time.Time{}, false
	}
	t := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
	return t, t.Day() == d
}

// atoi reads digits the patterns above already checked.
func atoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
