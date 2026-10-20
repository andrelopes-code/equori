package domain

import "testing"

func input(ref string, lines ...StatementLine) StatementInput {
	m := month(ref)
	d := DatesFor(m, rule("2026-01", 3, 10, "next"))
	return StatementInput{Reference: m, Closing: d.Closing, Due: d.DueUnadjusted, Lines: lines}
}

func charge(date string, a int64) StatementLine {
	return StatementLine{Role: RoleCharge, Amount: -a, Date: day(date)}
}

func credit(date string, a int64) StatementLine {
	return StatementLine{Role: RoleCredit, Amount: a, Date: day(date)}
}

func payment(date string, a int64) StatementLine {
	return StatementLine{Role: RolePayment, Amount: a, Date: day(date)}
}

// Statement 2026-11 closes on 2026-11-03 and is due on 2026-11-10; payments made after its
// closing are billed on 2026-12 (A89).
func TestSummarize(t *testing.T) {
	t.Parallel()
	financed := input("2026-11", charge("2026-10-14", 200000))
	financed.Financed = true
	tests := []struct {
		name     string
		in       []StatementInput
		today    string
		status   string
		unpaid   int64
		opening2 *int64
	}{
		{
			name:  "full payment",
			in:    []StatementInput{input("2026-11", charge("2026-10-14", 150000)), input("2026-12", payment("2026-11-10", 150000))},
			today: "2026-11-12", status: StatusPaid,
		},
		{
			name: "early payment before closing",
			in: []StatementInput{
				input("2026-11", charge("2026-10-14", 150000), payment("2026-10-28", 30000)),
				input("2026-12", payment("2026-11-10", 120000)),
			},
			today: "2026-11-12", status: StatusPaid,
		},
		{name: "open without payment", in: []StatementInput{input("2026-11", charge("2026-10-14", 150000))}, today: "2026-11-01", status: StatusOpen, unpaid: 150000},
		{name: "closed before due", in: []StatementInput{input("2026-11", charge("2026-10-14", 150000))}, today: "2026-11-05", status: StatusClosed, unpaid: 150000},
		{
			name:  "partial before due",
			in:    []StatementInput{input("2026-11", charge("2026-10-14", 150000)), input("2026-12", payment("2026-11-05", 100000))},
			today: "2026-11-05", status: StatusPartiallyPaid, unpaid: 50000,
		},
		{
			name: "partial after due stays in the next opening",
			in: []StatementInput{
				input("2026-11", charge("2026-10-14", 150000)),
				input("2026-12", payment("2026-11-10", 100000), charge("2026-11-05", 6250)),
			},
			today: "2026-11-11", status: StatusOverdue, unpaid: 50000, opening2: ptr(int64(150000)),
		},
		{
			name:  "overpayment leaves a credit balance",
			in:    []StatementInput{input("2026-11", charge("2026-10-14", 150000)), input("2026-12", payment("2026-11-10", 160000))},
			today: "2026-11-11", status: StatusPaid, opening2: ptr(int64(150000)),
		},
		{
			name:  "refund billed on the statement",
			in:    []StatementInput{input("2026-11", charge("2026-10-14", 150000), credit("2026-10-20", 50000)), input("2026-12", payment("2026-11-10", 100000))},
			today: "2026-11-11", status: StatusPaid,
		},
		{
			name:  "payment dated after today does not settle",
			in:    []StatementInput{input("2026-11", charge("2026-10-14", 150000)), input("2026-12", payment("2026-11-20", 150000))},
			today: "2026-11-11", status: StatusOverdue, unpaid: 150000,
		},
		{name: "empty past statement", in: []StatementInput{input("2026-11")}, today: "2026-12-01", status: StatusPaid},
		{name: "financed", in: []StatementInput{financed}, today: "2026-11-12", status: StatusFinanced, unpaid: 200000},
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
	t.Parallel()
	got := Summarize([]StatementInput{input("2026-11",
		charge("2026-10-14", 23000), charge("2026-10-20", 33334), credit("2026-10-21", 5000), payment("2026-10-28", 10000))}, day("2026-11-05"))[0]
	if got.Charges != 56334 || got.Credits != 5000 || got.Payments != 10000 || got.AmountDue != 41334 ||
		got.EarlyPayments != 10000 || got.BilledAmount != 51334 || got.Unpaid != 41334 {
		t.Fatalf("summary = %+v", got)
	}
}

// The lines of Nubank Gold of the design's evidence: 2026-09 (closing 2026-08-28) and
// 2026-10 (closing 2026-09-28), with the refund of 72.90 received after the closing of
// 2026-09 and before its payment.
func TestSummarizeBalanceAtClosing(t *testing.T) {
	t.Parallel()
	sep := StatementInput{Reference: month("2026-09"), Closing: day("2026-08-28"), Due: day("2026-09-08"), Lines: []StatementLine{
		charge("2026-08-20", 77354), charge("2026-08-27", 112089), credit("2026-08-18", 8614), payment("2026-08-04", 77354),
	}}
	oct := StatementInput{Reference: month("2026-10"), Closing: day("2026-09-28"), Due: day("2026-10-05"), Lines: []StatementLine{
		charge("2026-09-20", 228132), credit("2026-08-31", 7290), payment("2026-09-05", 96185),
		payment("2026-09-14", 100000), credit("2026-09-18", 49667),
	}}
	nov := StatementInput{Reference: month("2026-11"), Closing: day("2026-10-29"), Due: day("2026-11-05"), Lines: []StatementLine{
		payment("2026-10-05", 78465),
	}}
	got := Summarize([]StatementInput{sep, oct, nov}, day("2026-10-20"))
	if s := got[0]; s.AmountDue != 103475 || s.Settled != 103475 || s.Unpaid != 0 || s.Status != StatusPaid {
		t.Fatalf("2026-09 = %+v", s)
	}
	if s := got[1]; s.Opening != 103475 || s.Charges != 228132 || s.Credits != 56957 || s.PriorCredits != 7290 ||
		s.Payments != 196185 || s.EarlyPayments != 100000 || s.AmountDue != 78465 || s.BilledAmount != 178465 ||
		s.Settled != 78465 || s.Unpaid != 0 || s.Status != StatusPaid {
		t.Fatalf("2026-10 = %+v", s)
	}
	if s := got[2]; s.Opening != 78465 || s.AmountDue != 0 || s.EarlyPayments != 0 || s.Status != StatusOpen {
		t.Fatalf("2026-11 = %+v", s)
	}
}

func TestSummarizeEmptyStatementCarriesItsOpening(t *testing.T) {
	t.Parallel()
	got := Summarize([]StatementInput{
		input("2026-10", charge("2026-09-14", 50000)), input("2026-11"), input("2026-12", charge("2026-11-14", 1000)),
	}, day("2026-12-20"))
	if got[1].Opening != 50000 || got[1].AmountDue != 50000 || got[2].Opening != 50000 || got[2].AmountDue != 51000 {
		t.Fatalf("summaries = %+v", got)
	}
}
