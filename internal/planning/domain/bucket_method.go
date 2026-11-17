package domain

import (
	"slices"
	"time"
)

// Method is a version of the bucket method: the buckets in force from the month From (A240).
type Method struct {
	From    time.Time
	Buckets []Bucket
}

// MethodAt returns the method of month among versions sorted by From: the last version that
// starts at or before month, or the first version. False without a version or when the version
// holds no bucket.
func MethodAt(versions []Method, month time.Time) (Method, bool) {
	if len(versions) == 0 {
		return Method{}, false
	}

	found := versions[0]

	for _, v := range versions {
		if v.From.After(month) {
			break
		}

		found = v
	}

	return found, len(found.Buckets) > 0
}

// NextFrom returns the From of the version after the method of month; false when it is the last.
func NextFrom(versions []Method, month time.Time) (time.Time, bool) {
	method, _ := MethodAt(versions, month)

	i := slices.IndexFunc(versions, func(v Method) bool { return v.From.After(method.From) })
	if i < 0 {
		return time.Time{}, false
	}

	return versions[i].From, true
}

// LeadingEmpty returns the From of each version without buckets that has no version with
// buckets before it (A240, normal form).
func LeadingEmpty(versions []Method) []time.Time {
	var out []time.Time

	for _, v := range versions {
		if len(v.Buckets) > 0 {
			break
		}

		out = append(out, v.From)
	}

	return out
}
