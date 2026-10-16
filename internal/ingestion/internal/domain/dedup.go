package domain

import (
	"crypto/sha256"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// NormalizeDescription lowercases, trims and collapses inner spaces.
func NormalizeDescription(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}

// Ordinals numbers the lines without an external id that are identical within one file,
// so that two equal purchases on one day stay two records (chapter 5, 5.5).
type Ordinals map[string]int

// Next returns the ordinal of r in its file; records with an external id have ordinal 0.
func (o Ordinals) Next(r NormalizedRecord) int {
	if r.ExternalID != "" {
		return 0
	}
	k := lineIdentity(r)
	n := o[k]
	o[k] = n + 1
	return n
}

func lineIdentity(r NormalizedRecord) string {
	return r.Date.Format(time.DateOnly) + "\x00" + strconv.FormatInt(r.Amount, 10) + "\x00" + NormalizeDescription(r.Description)
}

// DedupKey identifies a statement line across imports (I10): the source's external id when
// present, otherwise the line itself and its ordinal. Line keys leave the source out, so a
// line seen in a CSV export and again in an OFX file without FITID is one record.
func DedupKey(accountID uuid.UUID, source Source, r NormalizedRecord, ordinal int) []byte {
	var key string
	if r.ExternalID != "" {
		key = accountID.String() + "\x00" + string(source) + "\x00id\x00" + r.ExternalID
	} else {
		key = accountID.String() + "\x00line\x00" + lineIdentity(r) + "\x00" + strconv.Itoa(ordinal)
	}
	sum := sha256.Sum256([]byte(key))
	return sum[:]
}
