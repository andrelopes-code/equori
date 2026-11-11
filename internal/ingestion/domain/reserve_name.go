package domain

import (
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// ReserveOutcome is what a bank line's reserve movement resolves to (A212): a transfer, a wait
// for the owner, or, with neither, an ordinary line.
type ReserveOutcome struct {
	TransferTo *uuid.UUID
	Review     bool
}

// ResolveReserve decides a line against every reserved balance of its connection, mapped or
// not: an identifier decides, and a name resolves only when one candidate exists on the line's
// date (A212).
func ResolveReserve(r NormalizedRecord, reserves []ExternalAccount) ReserveOutcome {
	if !r.ReserveMove {
		return ReserveOutcome{}
	}

	candidates := reserveCandidates(r, answering(r, reserves))

	switch len(candidates) {
	case 0:
		return ReserveOutcome{Review: slices.ContainsFunc(reserves, func(x ExternalAccount) bool {
			return x.State() == MappingMapped && !r.Date.Before(*x.SyncFrom)
		})}
	case 1:
		x := candidates[0]
		if x.State() != MappingMapped || r.Date.Before(*x.SyncFrom) {
			return ReserveOutcome{}
		}

		return ReserveOutcome{TransferTo: x.AccountID}
	}

	return ReserveOutcome{Review: slices.ContainsFunc(candidates, func(x ExternalAccount) bool {
		return x.State() == MappingMapped
	})}
}

// answering leaves out a reserve that cannot own the line: one the owner replaced, or one the
// item stopped listing before the line's date (A214).
func answering(r NormalizedRecord, reserves []ExternalAccount) []ExternalAccount {
	return slices.DeleteFunc(slices.Clone(reserves), func(x ExternalAccount) bool {
		return x.GoneSince != nil && (x.Ignored || r.Date.After(*x.GoneSince))
	})
}

func reserveCandidates(r NormalizedRecord, reserves []ExternalAccount) []ExternalAccount {
	if r.ReserveExternalID != "" {
		i := slices.IndexFunc(reserves, func(x ExternalAccount) bool { return x.ExternalID == r.ReserveExternalID })
		if i < 0 {
			return nil
		}

		return reserves[i : i+1]
	}

	key := textfold.Key(r.ReserveName)
	if key == "" {
		return nil
	}

	var (
		candidates []ExternalAccount
		held       bool
		heldUntil  *time.Time
	)

	for _, x := range reserves {
		if textfold.Key(x.Name) != key {
			continue
		}

		held = true

		if x.NameOn != nil && (heldUntil == nil || x.NameOn.After(*heldUntil)) {
			heldUntil = x.NameOn
		}

		if x.NameFrom == nil || !r.Date.Before(*x.NameFrom) {
			candidates = append(candidates, x)
		}
	}

	if held && (heldUntil == nil || r.Date.After(*heldUntil)) {
		return candidates
	}

	for _, x := range reserves {
		if textfold.Key(x.Name) != key && slices.ContainsFunc(x.FormerNames, func(n string) bool { return textfold.Key(n) == key }) {
			candidates = append(candidates, x)
		}
	}

	return candidates
}
