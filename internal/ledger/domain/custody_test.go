package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestBuildCustodyTransfer(t *testing.T) {
	t.Parallel()

	from, to := uuid.New(), uuid.New()
	tests := []struct {
		name     string
		quantity int64
		held     int64
		cost     int64
		want     int64
	}{
		{"S436 part of the holding", 40, 100, 100000, 40000},
		{"the whole holding takes the whole cost", 100, 100, 100001, 100001},
		{"a fraction rounds half to even", 1, 3, 1000, 333},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			o := CustodyOrder{AccountID: from, Quantity: shares(t, tt.quantity)}
			h := Holding{Quantity: shares(t, tt.held), CostBasis: brl(t, tt.cost)}

			postings, err := BuildCustodyTransfer(o, to, h)
			if err != nil {
				t.Fatal(err)
			}

			if len(postings) != 2 {
				t.Fatalf("postings = %+v", postings)
			}

			out, in := postings[0], postings[1]
			if out.AccountID != from || out.Amount.Amount() != -tt.quantity ||
				out.Weight.Amount() != -tt.want {
				t.Fatalf("giving posting = %+v", out)
			}

			if in.AccountID != to || in.Amount.Amount() != tt.quantity ||
				in.Weight.Amount() != tt.want {
				t.Fatalf("receiving posting = %+v", in)
			}
		})
	}
}

func TestBuildCustodyTransferErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		quantity int64
		held     int64
		field    string
		message  string
	}{
		{
			"above the holding",
			101,
			100,
			"quantity",
			"must not exceed the MXRF11 100 held on the trade date",
		},
		{"zero", 0, 100, "quantity", "must be positive"},
		{"negative", -1, 100, "quantity", "must be positive"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			o := CustodyOrder{AccountID: uuid.New(), Quantity: shares(t, tt.quantity)}
			h := Holding{Quantity: shares(t, tt.held), CostBasis: brl(t, 100000)}

			_, err := BuildCustodyTransfer(o, uuid.New(), h)

			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tt.field || fe.Message != tt.message {
				t.Fatalf("err = %v, want %s %q", err, tt.field, tt.message)
			}
		})
	}
}
