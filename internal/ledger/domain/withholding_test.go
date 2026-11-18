package domain

import (
	"testing"
	"time"
)

var testTable = WithholdingTable{
	IncomeTax: []TaxBand{
		{UpToDays: 180, RateBP: 2250},
		{UpToDays: 360, RateBP: 2000},
		{UpToDays: 720, RateBP: 1750},
		{RateBP: 1500},
	},
	IOF: []int{9600, 9300, 9000, 8600, 8300, 8000, 7600, 7300, 7000, 6600},
}

func TestEstimateWithholding(t *testing.T) {
	sale := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)
	before := func(days int) time.Time { return sale.AddDate(0, 0, -days) }

	tests := []struct {
		name     string
		lots     []Lot
		proceeds int64
		want     Withholding
	}{
		{
			// FS-S5: gain 100.00 after 10 days.
			name:     "iof then income tax on the rest",
			lots:     []Lot{{AcquiredOn: before(10), Quantity: 100, Cost: 100000}},
			proceeds: 110000,
			want:     Withholding{IOF: 6600, IncomeTax: 765},
		},
		{
			// FS-S6: each lot takes the rate of its own period.
			name: "each lot has its own period",
			lots: []Lot{
				{AcquiredOn: before(400), Quantity: 60, Cost: 60000},
				{AcquiredOn: before(200), Quantity: 40, Cost: 50000},
			},
			proceeds: 130000,
			want:     Withholding{IncomeTax: 3150 + 400},
		},
		{
			// FS-S7: no gain, no tax.
			name:     "a loss pays nothing",
			lots:     []Lot{{AcquiredOn: before(10), Quantity: 100, Cost: 100000}},
			proceeds: 90000,
			want:     Withholding{},
		},
		{
			name:     "the band of 180 days is the first",
			lots:     []Lot{{AcquiredOn: before(180), Quantity: 1, Cost: 1000}},
			proceeds: 2000,
			want:     Withholding{IncomeTax: 225},
		},
		{
			name:     "181 days is the second band",
			lots:     []Lot{{AcquiredOn: before(181), Quantity: 1, Cost: 1000}},
			proceeds: 2000,
			want:     Withholding{IncomeTax: 200},
		},
		{
			name:     "above 720 days",
			lots:     []Lot{{AcquiredOn: before(721), Quantity: 1, Cost: 1000}},
			proceeds: 2000,
			want:     Withholding{IncomeTax: 150},
		},
		{
			name:     "no iof from day 11 of the table",
			lots:     []Lot{{AcquiredOn: before(11), Quantity: 1, Cost: 1000}},
			proceeds: 2000,
			want:     Withholding{IncomeTax: 225},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateWithholding(testTable, tt.lots, tt.proceeds, sale)
			if got != tt.want {
				t.Errorf("withholding = %+v, want %+v", got, tt.want)
			}
		})
	}
}

// Coverage row U-02: a table of one band and no IOF ignores the days held.
func TestWithholdingTableFlat(t *testing.T) {
	t.Parallel()

	flat := WithholdingTable{IncomeTax: []TaxBand{{RateBP: 1500}}}
	withIOF := WithholdingTable{IncomeTax: []TaxBand{{RateBP: 1500}}, IOF: []int{9600}}

	if !flat.Flat() || testTable.Flat() || withIOF.Flat() {
		t.Errorf("Flat = %v, %v, %v; want true, false, false",
			flat.Flat(), testTable.Flat(), withIOF.Flat())
	}
}
