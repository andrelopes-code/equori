package page

import (
	"errors"
	"testing"
	"time"
)

func TestLimit(t *testing.T) {
	ptr := func(n int) *int { return &n }
	tests := []struct {
		name      string
		requested *int
		want      int
		wantErr   bool
	}{
		{name: "default", requested: nil, want: DefaultLimit},
		{name: "min", requested: ptr(1), want: 1},
		{name: "max", requested: ptr(MaxLimit), want: MaxLimit},
		{name: "zero", requested: ptr(0), wantErr: true},
		{name: "above max", requested: ptr(MaxLimit + 1), wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Limit(tt.requested)
			if (err != nil) != tt.wantErr || got != tt.want {
				t.Fatalf("Limit = %d, %v; want %d, err %v", got, err, tt.want, tt.wantErr)
			}
		})
	}
}

type key struct {
	Date time.Time `json:"d"`
	ID   int64     `json:"i"`
}

func TestCursorRoundTrip(t *testing.T) {
	in := key{Date: time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC), ID: 42}

	cursor, err := EncodeCursor(in)
	if err != nil {
		t.Fatal(err)
	}
	var out key
	if err := DecodeCursor(cursor, &out); err != nil {
		t.Fatal(err)
	}
	if !out.Date.Equal(in.Date) || out.ID != in.ID {
		t.Fatalf("round trip = %+v, want %+v", out, in)
	}
}

func TestDecodeCursorRejectsGarbage(t *testing.T) {
	foreign, err := EncodeCursor(map[string]int{"other": 1})
	if err != nil {
		t.Fatal(err)
	}
	for _, cursor := range []string{"%%%", "bm90IGpzb24", foreign} {
		var out key
		if err := DecodeCursor(cursor, &out); !errors.Is(err, ErrInvalidCursor) {
			t.Errorf("DecodeCursor(%q) err = %v, want ErrInvalidCursor", cursor, err)
		}
	}
}

func TestTrim(t *testing.T) {
	if items, more := Trim([]int{1, 2, 3}, 2); len(items) != 2 || !more {
		t.Fatalf("Trim(3 rows, 2) = %v, %v", items, more)
	}
	if items, more := Trim([]int{1, 2}, 2); len(items) != 2 || more {
		t.Fatalf("Trim(2 rows, 2) = %v, %v", items, more)
	}
}
