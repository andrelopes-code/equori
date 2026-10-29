package domain

import (
	"testing"

	"github.com/google/uuid"
)

// A136: with two postings on one card, a correction that names no statement keeps each
// posting's own choice, pairing the postings of the card in order.
func TestKeepStatementBasisPairsPostingsInOrder(t *testing.T) {
	t.Parallel()
	card := uuid.New()
	nov, dec := month("2026-11"), month("2026-12")
	prev := []Posting{
		{AccountID: card, Statement: &nov, StatementBasis: BasisDate},
		{AccountID: card, Statement: &dec, StatementBasis: BasisOwner},
	}
	next := []Posting{{AccountID: card}, {AccountID: card}}

	got := keepStatementBasis(prev, next)

	if got[0].Statement != nil || got[0].StatementBasis != "" {
		t.Fatalf("first posting = %v %q, want it left to the date", got[0].Statement, got[0].StatementBasis)
	}
	if got[1].Statement == nil || *got[1].Statement != dec || got[1].StatementBasis != BasisOwner {
		t.Fatalf("second posting = %v %q, want 2026-12 owner", got[1].Statement, got[1].StatementBasis)
	}
}
