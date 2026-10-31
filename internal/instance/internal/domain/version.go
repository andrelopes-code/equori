package domain

import (
	"regexp"
	"strconv"
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

	return b.prerelease
}

// Checkable reports whether binary parses as such a version (A159.2).
func Checkable(binary string) bool {
	_, ok := parseVersion(binary)

	return ok
}

type version struct {
	numbers    [3]int
	prerelease bool
}

func parseVersion(s string) (version, bool) {
	m := versionPattern.FindStringSubmatch(s)
	if m == nil {
		return version{}, false
	}

	v := version{prerelease: m[4] != ""}

	for i := range v.numbers {
		n, err := strconv.Atoi(m[i+1])
		if err != nil {
			return version{}, false
		}

		v.numbers[i] = n
	}

	return v, true
}
