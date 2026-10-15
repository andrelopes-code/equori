package domain

import "testing"

func input(ref string, lines ...StatementLine) StatementInput {
	m := month(ref)
	d := DatesFor(m, rule("2026-01", 3, 10, "next"))
	return StatementInput{Reference: m, Closing: d.Closing, Due: d.DueUnadjusted, Lines: lines}
}

func charge(a int64) StatementLine  { return StatementLine{Role: RoleCharge, Amount: -a} }
func credit(a int64) StatementLine  { return StatementLine{Role: RoleCredit, Amount: a} }
func payment(a int64) StatementLine { return StatementLine{Role: RolePayment, Amount: a} }

func TestSummarize(t *testing.T) {
	tests := []struct {
		name     string
		in       []StatementInput
		today    string
		status   string
		unpaid   int64
		opening2 *int64
	}{
		{name: "full payment", in: []StatementInput{input("2026-11", charge(150000), payment(150000))}, today: "2026-11-12", status: StatusPaid},
		{name: "early payments", in: []StatementInput{input("2026-11", charge(150000), payment(30000), payment(120000))}, today: "2026-11-01", status: StatusPaid},
		{name: "open without payment", in: []StatementInput{input("2026-11", charge(150000))}, today: "2026-11-01", status: StatusOpen, unpaid: 150000},
		{name: "closed before due", in: []StatementInput{input("2026-11", charge(150000))}, today: "2026-11-05", status: StatusClosed, unpaid: 150000},
		{name: "partial before due", in: []StatementInput{input("2026-11", charge(150000), payment(100000))}, today: "2026-11-05", status: StatusPartiallyPaid, unpaid: 50000},
		{
			name:  "partial after due carries to next",
			in:    []StatementInput{input("2026-11", charge(150000), payment(100000)), input("2026-12", charge(6250))},
			today: "2026-11-11", status: StatusOverdue, unpaid: 50000, opening2: ptr(int64(50000)),
		},
		{
			name:  "overpayment becomes credit",
			in:    []StatementInput{input("2026-11", charge(150000), payment(160000)), input("2026-12")},
			today: "2026-11-11", status: StatusPaid, unpaid: -10000, opening2: ptr(int64(-10000)),
		},
		{name: "refund reduces amount due", in: []StatementInput{input("2026-11", charge(150000), credit(50000), payment(100000))}, today: "2026-11-11", status: StatusPaid},
		{name: "empty past statement", in: []StatementInput{input("2026-11")}, today: "2026-12-01", status: StatusPaid},
		{name: "financed", in: []StatementInput{func() StatementInput {
			s := input("2026-11", charge(200000), payment(200000))
			s.Financed = true
			return s
		}()}, today: "2026-11-12", status: StatusFinanced},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Summarize(tt.in, day(tt.today))
			if got[0].Status != tt.status || got[0].Unpaid != tt.unpaid {
				t.Fatalf("summary = %+v; want status %s unpaid %d", got[0], tt.status, tt.unpaid)
			}
			if tt.opening2 != nil && got[1].Opening != *tt.opening2 {
				t.Fatalf("next opening = %d, want %d", got[1].Opening, *tt.opening2)
			}
		})
	}
}

func TestSummarizeAmounts(t *testing.T) {
	got := Summarize([]StatementInput{input("2026-11", charge(23000), charge(33334), credit(5000), payment(10000))}, day("2026-11-05"))[0]
	if got.Charges != 56334 || got.Credits != 5000 || got.AmountDue != 51334 || got.Payments != 10000 || got.Unpaid != 41334 {
		t.Fatalf("summary = %+v", got)
	}
}
