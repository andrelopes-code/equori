package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func oct(d int) time.Time { return time.Date(2026, 10, d, 0, 0, 0, 0, time.UTC) }

// A98, A99: the comparison of a line with each posting the blocking keeps.
func TestScore(t *testing.T) {
	t.Parallel()
	uber, ifood, drogasil := uuid.New(), uuid.New(), uuid.New()
	tests := []struct {
		name    string
		line    MatchLine
		posting LedgerPosting
		want    int
		blocked bool
	}{
		{"S91 identical, same day, same payee", MatchLine{oct(20), -712, uber, "Dl *Uberrides"}, LedgerPosting{Date: oct(20), Amount: -712, PayeeID: uber, Description: "Uber"}, 13, false},
		{"S92 within the bound, same day, same payee", MatchLine{oct(20), -712, uber, "Dl *Uberrides"}, LedgerPosting{Date: oct(20), Amount: -700, PayeeID: uber}, 5, false},
		{"S93 two days away", MatchLine{oct(20), -712, uber, ""}, LedgerPosting{Date: oct(18), Amount: -712, PayeeID: uber}, 12, false},
		{"S94 payees differ", MatchLine{oct(20), -4590, ifood, ""}, LedgerPosting{Date: oct(20), Amount: -4590, PayeeID: drogasil}, 3, false},
		{"S95 seven days away", MatchLine{oct(17), -80000, uber, ""}, LedgerPosting{Date: oct(10), Amount: -80000, PayeeID: uber}, 9, false},
		{"S32 identical, same day, no payee", MatchLine{oct(10), -4590, uuid.Nil, "PADARIA"}, LedgerPosting{Date: oct(10), Amount: -4590}, 9, false},
		{"within 1%", MatchLine{oct(10), -100000, uuid.Nil, ""}, LedgerPosting{Date: oct(10), Amount: -99100}, 6, false},
		{"descriptions overlap without payee", MatchLine{oct(10), -4590, ifood, "IFOOD *Restaurante Sabor"}, LedgerPosting{Date: oct(10), Amount: -4590, Description: "Restaurante Sabor"}, 11, false},
		{"accents and digits fold away", MatchLine{oct(10), -4590, uuid.Nil, "FARMACIA SAO JOAO 123"}, LedgerPosting{Date: oct(10), Amount: -4590, Description: "Farmácia São João"}, 11, false},
		{"eleven days away", MatchLine{oct(21), -712, uuid.Nil, ""}, LedgerPosting{Date: oct(10), Amount: -712}, 0, true},
		{"other sign", MatchLine{oct(10), 712, uuid.Nil, ""}, LedgerPosting{Date: oct(10), Amount: -712}, 0, true},
		{"beyond 20%", MatchLine{oct(10), -10000, uuid.Nil, ""}, LedgerPosting{Date: oct(10), Amount: -7999}, 0, true},
		{"small amounts within 1.00", MatchLine{oct(10), -300, uuid.Nil, ""}, LedgerPosting{Date: oct(10), Amount: -390}, 1, false},
		{"small amounts beyond 1.00", MatchLine{oct(10), -300, uuid.Nil, ""}, LedgerPosting{Date: oct(10), Amount: -401}, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Score(tt.line, tt.posting)
			if ok == tt.blocked || (ok && got.Score != tt.want) {
				t.Fatalf("Score = %+v, %v; want %d, kept %v", got, ok, tt.want, !tt.blocked)
			}
		})
	}
}

// A100: the zone of each line; postings are assigned one to one, highest score first.
func TestAssign(t *testing.T) {
	t.Parallel()
	uber := uuid.New()
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	tests := []struct {
		name     string
		lines    []MatchLine
		postings []LedgerPosting
		want     []Assignment
	}{
		{
			name:     "S91 link",
			lines:    []MatchLine{{oct(20), -712, uber, ""}},
			postings: []LedgerPosting{{TransactionID: a, Date: oct(20), Amount: -712, PayeeID: uber}},
			want:     []Assignment{{Zone: ZoneLink, TransactionID: a}},
		},
		{
			name:     "S92 probable",
			lines:    []MatchLine{{oct(20), -712, uber, ""}},
			postings: []LedgerPosting{{TransactionID: a, Date: oct(20), Amount: -700, PayeeID: uber}},
			want:     []Assignment{{Zone: ZoneProbable}},
		},
		{
			name:  "S93 ambiguous",
			lines: []MatchLine{{oct(20), -712, uber, ""}},
			postings: []LedgerPosting{
				{TransactionID: a, Date: oct(18), Amount: -712, PayeeID: uber}, {TransactionID: b, Date: oct(20), Amount: -712, PayeeID: uber},
			},
			want: []Assignment{{Zone: ZoneAmbiguous}},
		},
		{
			name:  "S35 ambiguous without payees",
			lines: []MatchLine{{oct(10), -5000, uuid.Nil, ""}},
			postings: []LedgerPosting{
				{TransactionID: a, Date: oct(9), Amount: -5000}, {TransactionID: b, Date: oct(10), Amount: -5000},
			},
			want: []Assignment{{Zone: ZoneAmbiguous}},
		},
		{
			name:  "a close second below the link threshold is probable",
			lines: []MatchLine{{oct(10), -5000, uuid.Nil, "PADARIA"}},
			postings: []LedgerPosting{
				{TransactionID: a, Date: oct(10), Amount: -5000}, {TransactionID: b, Date: oct(9), Amount: -4990, Description: "Padaria"},
			},
			want: []Assignment{{Zone: ZoneProbable}},
		},
		{
			name:     "S94 new",
			lines:    []MatchLine{{oct(20), -4590, uuid.New(), ""}},
			postings: []LedgerPosting{{TransactionID: a, Date: oct(20), Amount: -4590, PayeeID: uuid.New()}},
			want:     []Assignment{{Zone: ZoneNew}},
		},
		{
			name:  "Review Focus 2: the higher score takes the posting",
			lines: []MatchLine{{oct(12), -5000, uuid.Nil, ""}, {oct(10), -5000, uuid.Nil, ""}},
			postings: []LedgerPosting{
				{TransactionID: a, Date: oct(10), Amount: -5000}, {TransactionID: a, Date: oct(10), Amount: -5000},
			},
			want: []Assignment{{Zone: ZoneNew}, {Zone: ZoneLink, TransactionID: a}},
		},
		{
			name:  "each line links its own posting",
			lines: []MatchLine{{oct(10), -5000, uuid.Nil, ""}, {oct(20), -5000, uuid.Nil, ""}},
			postings: []LedgerPosting{
				{TransactionID: c, Date: oct(20), Amount: -5000}, {TransactionID: a, Date: oct(10), Amount: -5000},
			},
			want: []Assignment{{Zone: ZoneLink, TransactionID: a}, {Zone: ZoneLink, TransactionID: c}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Assign(tt.lines, tt.postings)
			if len(got) != len(tt.want) {
				t.Fatalf("assignments = %+v", got)
			}
			for i, w := range tt.want {
				if got[i].Zone != w.Zone || got[i].TransactionID != w.TransactionID {
					t.Fatalf("line %d = %+v, want zone %s, transaction %s", i, got[i], w.Zone, w.TransactionID)
				}
				if (w.Zone == ZoneProbable || w.Zone == ZoneAmbiguous) && len(got[i].Candidates) == 0 {
					t.Fatalf("line %d in review without candidates", i)
				}
			}
		})
	}
}
