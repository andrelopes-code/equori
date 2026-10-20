package pluggy

import (
	"testing"
	"time"
)

func ptr[T any](v T) *T { return &v }

func saoPaulo(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Fatal(err)
	}
	return loc
}

func TestNormalize(t *testing.T) {
	t.Parallel()
	loc := saoPaulo(t)
	checking := Account{ID: "acc-1", Type: "BANK", Subtype: SubtypeChecking, CurrencyCode: "BRL"}
	card := Account{ID: "acc-2", Type: TypeCredit, Subtype: SubtypeCard, CurrencyCode: "BRL"}
	bills := map[string]Bill{"bill-1": {ID: "bill-1", DueDate: "2026-12-10T00:00:00.000Z"}}

	t.Run("bank debit", func(t *testing.T) {
		r, ok, err := Normalize(Transaction{
			ID: "t1", Description: "Padaria", DescriptionRaw: ptr("PAG*PADARIA"), CurrencyCode: "BRL", Amount: "-8.5",
			Date: "2026-10-07T00:00:00.000Z", Balance: "1234.56", Status: "POSTED", Category: ptr("Bakery"), CategoryID: ptr("01010000"),
		}, checking, bills, 2, loc)
		if err != nil || !ok {
			t.Fatal(ok, err)
		}
		if r.ExternalID != "t1" || r.Amount != -850 || r.Date.Format(time.DateOnly) != "2026-10-07" || r.Description != "PAG*PADARIA" ||
			r.Pending || r.BalanceAfter == nil || *r.BalanceAfter != 123456 || r.Category == nil || r.Category.ID != "01010000" || r.Category.Name != "Bakery" {
			t.Fatalf("record = %+v", r)
		}
	})
	t.Run("bank pending is skipped", func(t *testing.T) {
		if _, ok, err := Normalize(Transaction{ID: "t2", Amount: "-10", Date: "2026-11-20T00:00:00.000Z", Status: statusPending, CurrencyCode: "BRL"}, checking, bills, 2, loc); ok || err != nil {
			t.Fatalf("ok %v, err %v", ok, err)
		}
	})
	t.Run("card charge changes sign and keeps pending", func(t *testing.T) {
		r, ok, err := Normalize(Transaction{ID: "t3", Description: "MERCADO", Amount: "230", Date: "2026-11-05T00:00:00.000Z", Status: statusPending, CurrencyCode: "BRL"}, card, bills, 2, loc)
		if err != nil || !ok || r.Amount != -23000 || !r.Pending || r.DueDate != nil {
			t.Fatalf("record = %+v, %v, %v", r, ok, err)
		}
	})
	t.Run("card line with bill and installment", func(t *testing.T) {
		r, ok, err := Normalize(Transaction{
			ID: "t4", Description: "LOJA 3/6", Amount: "100", Date: "2026-11-01T00:00:00.000Z", Status: "POSTED", CurrencyCode: "BRL",
			CreditCardMetadata: &CardMetadata{InstallmentNumber: 3, TotalInstallments: 6, PurchaseDate: ptr("2026-08-14T00:00:00.000Z"), BillID: ptr("bill-1")},
		}, card, bills, 2, loc)
		if err != nil || !ok || r.Amount != -10000 || r.Pending || r.DueDate == nil || r.DueDate.Format(time.DateOnly) != "2026-12-10" ||
			r.Installment == nil || r.Installment.Number != 3 || r.Installment.Count != 6 || r.Installment.PurchaseDate.Format(time.DateOnly) != "2026-08-14" {
			t.Fatalf("record = %+v, %v, %v", r, ok, err)
		}
	})
	t.Run("card payment is a credit to the card", func(t *testing.T) {
		r, _, err := Normalize(Transaction{ID: "t5", Description: "PAGAMENTO", Amount: "-1500", Date: "2026-11-11T00:00:00.000Z", Status: "POSTED", CurrencyCode: "BRL"}, card, bills, 2, loc)
		if err != nil || r.Amount != 150000 {
			t.Fatalf("record = %+v, %v", r, err)
		}
	})
	t.Run("foreign line uses the account currency amount", func(t *testing.T) {
		r, _, err := Normalize(Transaction{ID: "t6", Description: "NETFLIX", Amount: "58", AmountInAccountCurrency: "298.19", CurrencyCode: "USD", Date: "2026-11-02T00:00:00.000Z", Status: "POSTED"}, card, bills, 2, loc)
		if err != nil || r.Amount != -29819 {
			t.Fatalf("record = %+v, %v", r, err)
		}
	})
	t.Run("instant after midnight UTC is a Sao Paulo date", func(t *testing.T) {
		r, _, err := Normalize(Transaction{ID: "t7", Amount: "-1", Date: "2026-11-02T01:30:00.000Z", Status: "POSTED", CurrencyCode: "BRL"}, checking, bills, 2, loc)
		if err != nil || r.Date.Format(time.DateOnly) != "2026-11-01" {
			t.Fatalf("date = %s, %v", r.Date, err)
		}
	})
	t.Run("rejections", func(t *testing.T) {
		for name, tx := range map[string]Transaction{
			"three decimals":                 {ID: "x", Amount: "1.005", Date: "2026-11-02T00:00:00.000Z", Status: "POSTED", CurrencyCode: "BRL"},
			"foreign without account amount": {ID: "x", Amount: "1", Date: "2026-11-02T00:00:00.000Z", Status: "POSTED", CurrencyCode: "USD"},
			"bad date":                       {ID: "x", Amount: "1", Date: "02/11/2026", Status: "POSTED", CurrencyCode: "BRL"},
			"missing id":                     {Amount: "1", Date: "2026-11-02T00:00:00.000Z", Status: "POSTED", CurrencyCode: "BRL"},
		} {
			if _, _, err := Normalize(tx, checking, bills, 2, loc); err == nil {
				t.Errorf("%s: accepted", name)
			}
		}
	})
}

func TestNormalizeReserveTransfer(t *testing.T) {
	t.Parallel()
	checking := Account{ID: "acc-1", Type: "BANK", Subtype: SubtypeChecking, CurrencyCode: "BRL"}
	const reserveOp = "TRANSFERENCIA_SALDO_RESERVADO"
	for _, tc := range []struct {
		name        string
		operation   *string
		description string
		amount      Decimal
		want        string
	}{
		{"money into a reserve", ptr(reserveOp), "Dinheiro reservado Cofrinho Mercado Livre", "-2000", "Cofrinho Mercado Livre"},
		{"money out of a reserve", ptr(reserveOp), "Dinheiro retirado Algum dinheiro", "2000", "Algum dinheiro"},
		{"reserved with a positive amount", ptr(reserveOp), "Dinheiro reservado X", "10", ""},
		{"withdrawn with a negative amount", ptr(reserveOp), "Dinheiro retirado X", "-10", ""},
		{"another operation type", ptr("PIX"), "Dinheiro reservado X", "-10", ""},
		{"no operation type", nil, "Dinheiro reservado X", "-10", ""},
		{"another description", ptr(reserveOp), "Rendimentos X", "-10", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r, ok, err := Normalize(Transaction{
				ID: "t1", Description: tc.description, OperationType: tc.operation, CurrencyCode: "BRL", Amount: tc.amount,
				Date: "2026-11-11T00:00:00.000Z", Status: "POSTED",
			}, checking, nil, 2, time.UTC)
			if err != nil || !ok {
				t.Fatal(ok, err)
			}
			if r.ReserveName != tc.want {
				t.Fatalf("ReserveName = %q, want %q", r.ReserveName, tc.want)
			}
		})
	}
}
