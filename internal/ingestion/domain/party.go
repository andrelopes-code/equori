package domain

import (
	"bytes"
	"crypto/sha256"
	"regexp"
	"slices"
	"strings"
)

// The window of A216 rule 3 and the counterparty values of A217 rule 4.
const (
	// PairingWindowDays equals the ledger's pairingWindowDays (A29, A216 rule 3).
	PairingWindowDays = 3

	CounterpartyHolder     = "holder"
	CounterpartyThirdParty = "third_party"
)

var partySchemes = []PartyScheme{
	{ID: "br_cnpj", Strip: "./-", Upper: true, Pattern: regexp.MustCompile(`^[0-9A-Z]{14}$`)},
	{ID: "br_cpf", Strip: ".-", Pattern: regexp.MustCompile(`^[0-9]{11}$`)},
}

// PartyID is a party identifier as an aggregator reports it: the ID of a scheme of
// PartySchemes and the value in the source's form (A217).
type PartyID struct {
	Scheme string
	Value  string
}

// PartyScheme names a system that issues party identifiers: the characters its canonical
// form removes, whether it upper-cases letters, and the pattern of the key.
type PartyScheme struct {
	ID      string
	Strip   string
	Upper   bool
	Pattern *regexp.Regexp
}

// PartySchemes returns the registry of party identifier schemes, ordered by ID (ADR 016).
func PartySchemes() []PartyScheme {
	return slices.Clone(partySchemes)
}

// PartyKey returns the key of id in the canonical form of its scheme; false for an unknown
// scheme and for a masked (holding '*') or malformed value (A217 rules 2 and 3).
func PartyKey(id PartyID) (string, bool) {
	for _, s := range partySchemes {
		if s.ID != id.Scheme {
			continue
		}

		key := strings.Map(func(r rune) rune {
			if strings.ContainsRune(s.Strip, r) {
				return -1
			}

			return r
		}, id.Value)
		if s.Upper {
			key = strings.ToUpper(key)
		}

		if !s.Pattern.MatchString(key) {
			return "", false
		}

		return key, true
	}

	return "", false
}

// PartyDigest returns the SHA-256 digest of "<scheme>:<key>"; false when id has no key (A221).
func PartyDigest(id PartyID) ([]byte, bool) {
	key, ok := PartyKey(id)
	if !ok {
		return nil, false
	}

	sum := sha256.Sum256([]byte(id.Scheme + ":" + key))

	return sum[:], true
}

// CounterpartyOf classifies the counterparty of a line against the holders of the book's
// mapped external accounts: holder, third_party, or "" without a key (A217 rule 4).
func CounterpartyOf(id *PartyID, holders [][]byte) string {
	if id == nil {
		return ""
	}

	digest, ok := PartyDigest(*id)
	if !ok {
		return ""
	}

	for _, h := range holders {
		if bytes.Equal(h, digest) {
			return CounterpartyHolder
		}
	}

	return CounterpartyThirdParty
}
