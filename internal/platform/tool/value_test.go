package tool

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestMoneyOf(t *testing.T) {
	t.Parallel()

	m, err := money.New(-123456, "BRL")
	if err != nil {
		t.Fatal(err)
	}

	if got, want := MoneyOf(m), (Money{Amount: "-1234.56", Currency: "BRL"}); got != want {
		t.Errorf("MoneyOf = %+v, want %+v", got, want)
	}
}

func TestDateJSON(t *testing.T) {
	t.Parallel()
	type wrapper struct {
		D Date `json:"d,omitzero"`
	}

	b, err := json.Marshal(wrapper{D: DateOf(time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC))})
	if err != nil {
		t.Fatal(err)
	}

	if string(b) != `{"d":"2026-10-20"}` {
		t.Errorf("marshal = %s", b)
	}

	if b, err = json.Marshal(wrapper{}); err != nil || string(b) != `{}` {
		t.Errorf("zero date marshal = %s, %v; want {}", b, err)
	}

	var w wrapper
	if err := json.Unmarshal([]byte(`{"d":"2026-10-20"}`), &w); err != nil || !w.D.Equal(time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("unmarshal = %v, %v", w.D, err)
	}

	if err := json.Unmarshal([]byte(`{"d":"2026-13-01"}`), &w); err == nil {
		t.Error("unmarshal of month 13 succeeded")
	}
}

func TestOptionalIntJSON(t *testing.T) {
	t.Parallel()
	type wrapper struct {
		N OptionalInt `json:"n,omitzero"`
	}

	tests := []struct {
		name    string
		in      string
		wantSet bool
		wantN   int
		wantOut string
	}{
		{"absent", `{}`, false, 0, `{}`},
		{"zero", `{"n":0}`, true, 0, `{"n":0}`},
		{"value", `{"n":500}`, true, 500, `{"n":500}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var w wrapper
			if err := json.Unmarshal([]byte(tt.in), &w); err != nil {
				t.Fatal(err)
			}

			if w.N.Set != tt.wantSet || w.N.N != tt.wantN {
				t.Errorf("decoded = %+v, want set %v n %d", w.N, tt.wantSet, tt.wantN)
			}

			b, err := json.Marshal(w)
			if err != nil || string(b) != tt.wantOut {
				t.Errorf("encoded = %s, %v; want %s", b, err, tt.wantOut)
			}
		})
	}

	if err := json.Unmarshal([]byte(`{"n":"x"}`), &wrapper{}); err == nil {
		t.Error("unmarshal of a string succeeded")
	}

	if s := schemaFor[wrapper](); s.err != nil || string(s.json) == "" ||
		!strings.Contains(string(s.json), `"n":{"type":"integer"}`) {
		t.Errorf("schema = %s, %v", s.json, s.err)
	}
}
