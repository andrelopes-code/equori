package domain

import (
	"cmp"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var versionPattern = regexp.MustCompile(`^v(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$`)

// Release is the newest release the version check found.
type Release struct {
	Version   string
	URL       string
	CheckedAt time.Time
}

// Newer reports whether latest is newer than binary under A159.4; false when either does not
// parse as vMAJOR.MINOR.PATCH with an optional pre-release suffix.
func Newer(binary, latest string) bool {
	b, bok := parseVersion(binary)
	l, lok := parseVersion(latest)

	if !bok || !lok {
		return false
	}

	for i := range b.numbers {
		if l.numbers[i] != b.numbers[i] {
			return l.numbers[i] > b.numbers[i]
		}
	}

	return comparePrerelease(l.prerelease, b.prerelease) > 0
}

// Checkable reports whether binary parses as such a version (A159.2).
func Checkable(binary string) bool {
	_, ok := parseVersion(binary)

	return ok
}

// Prerelease reports whether binary parses with a pre-release suffix (A159.2).
func Prerelease(binary string) bool {
	v, ok := parseVersion(binary)

	return ok && len(v.prerelease) > 0
}

type version struct {
	numbers [3]int
	// prerelease holds the dot-separated identifiers of the suffix; nil without one.
	prerelease []string
}

func parseVersion(s string) (version, bool) {
	m := versionPattern.FindStringSubmatch(s)
	if m == nil {
		return version{}, false
	}

	var v version

	if m[4] != "" {
		v.prerelease = strings.Split(m[4][1:], ".")
	}

	for i := range v.numbers {
		n, err := strconv.Atoi(m[i+1])
		if err != nil {
			return version{}, false
		}

		v.numbers[i] = n
	}

	return v, true
}

// comparePrerelease orders two suffixes as SemVer 2.0.0, item 11: a version without a suffix
// ranks above one with it; otherwise identifiers compare left to right, and a longer list ranks
// above its own prefix.
func comparePrerelease(a, b []string) int {
	switch {
	case len(a) == 0 && len(b) == 0:
		return 0
	case len(a) == 0:
		return 1
	case len(b) == 0:
		return -1
	}

	for i := range min(len(a), len(b)) {
		if c := compareIdentifier(a[i], b[i]); c != 0 {
			return c
		}
	}

	return cmp.Compare(len(a), len(b))
}

// compareIdentifier compares numeric identifiers as integers; a numeric one ranks below an
// alphanumeric one, and two alphanumeric ones compare in ASCII order.
func compareIdentifier(a, b string) int {
	an, aerr := strconv.ParseUint(a, 10, 64)
	bn, berr := strconv.ParseUint(b, 10, 64)

	switch {
	case aerr == nil && berr == nil:
		return cmp.Compare(an, bn)
	case aerr == nil:
		return -1
	case berr == nil:
		return 1
	}

	return strings.Compare(a, b)
}
