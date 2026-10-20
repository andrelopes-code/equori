package domain

import (
	"bytes"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestDedupKey(t *testing.T) {
	t.Parallel()
	account := uuid.New()
	day := time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC)
	line := NormalizedRecord{Date: day, Amount: -850, Description: "  Padaria  do  João "}
	same := NormalizedRecord{Date: day, Amount: -850, Description: "padaria do joão"}

	o := Ordinals{}
	first, second := DedupKey(account, SourceCSV, line, o.Next(line)), DedupKey(account, SourceCSV, same, o.Next(same))
	if bytes.Equal(first, second) {
		t.Fatal("two identical lines in one file share a key")
	}
	if again := DedupKey(account, SourceOFX, line, Ordinals{}.Next(line)); !bytes.Equal(first, again) {
		t.Fatal("the first identical line differs between files or sources")
	}
	withID := NormalizedRecord{ExternalID: "a1", Date: day, Amount: -850}
	if bytes.Equal(DedupKey(account, SourceOFX, withID, 0), DedupKey(uuid.New(), SourceOFX, withID, 0)) {
		t.Fatal("the same FITID on two accounts shares a key")
	}
	if bytes.Equal(DedupKey(account, SourceOFX, withID, 0), DedupKey(account, SourceCSV, withID, 0)) {
		t.Fatal("an OFX FITID and a CSV id share a key")
	}
	if len(first) != 32 {
		t.Fatalf("key length %d", len(first))
	}
}
