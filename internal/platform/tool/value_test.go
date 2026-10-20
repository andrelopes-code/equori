package tool

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestMoneyOf(t *testing.T) {
	m, err := money.New(-123456, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := MoneyOf(m), (Money{Amount: "-1234.56", Currency: "BRL"}); got != want {
		t.Errorf("MoneyOf = %+v, want %+v", got, want)
	}
}

func TestDateJSON(t *testing.T) {
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
