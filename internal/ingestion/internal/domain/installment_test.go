package domain

import (
	"bytes"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPlanKey(t *testing.T) {
	card := uuid.MustParse("01900000-0000-7000-8000-000000000001")
	i := Installment{Number: 3, Count: 6, PurchaseDate: time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC)}
	key := PlanKey(card, i, "LOJA EXEMPLO 03/06")
	for _, same := range []string{"Loja Exemplo 04/06", "LOJA  EXEMPLO PARC 5/6", "loja exemplo parcela 6 de 6", "LOJA EXEMPLO"} {
		if !bytes.Equal(PlanKey(card, i, same), key) {
			t.Errorf("%q has another key", same)
		}
	}
	other := []struct {
		name string
		key  []byte
	}{
		{"description", PlanKey(card, i, "OUTRA LOJA 03/06")},
		{"count", PlanKey(card, Installment{Count: 10, PurchaseDate: i.PurchaseDate}, "LOJA EXEMPLO")},
		{"purchase date", PlanKey(card, Installment{Count: 6, PurchaseDate: i.PurchaseDate.AddDate(0, 0, 1)}, "LOJA EXEMPLO")},
		{"card", PlanKey(uuid.MustParse("01900000-0000-7000-8000-000000000002"), i, "LOJA EXEMPLO")},
	}
	for _, o := range other {
		if bytes.Equal(o.key, key) {
			t.Errorf("another %s has the same key", o.name)
		}
	}
}
