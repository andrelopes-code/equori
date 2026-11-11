package domain

import (
	"testing"
	"time"
)

var rfcSecret = []byte("12345678901234567890")

func TestTOTPCode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		unix int64
		step int64
		code string
	}{
		{59, 1, "287082"},
		{1111111109, 37037036, "081804"},
		{1111111111, 37037037, "050471"},
		{1234567890, 41152263, "005924"},
		{2000000000, 66666666, "279037"},
		{20000000000, 666666666, "353130"},
	}

	for _, tt := range tests {
		step := TOTPStepAt(time.Unix(tt.unix, 0))
		if step != tt.step {
			t.Errorf("TOTPStepAt(%d) = %d, want %d", tt.unix, step, tt.step)
		}

		if got := TOTPCode(rfcSecret, step); got != tt.code {
			t.Errorf("TOTPCode(step %d) = %s, want %s", step, got, tt.code)
		}
	}
}

func TestMatchTOTP(t *testing.T) {
	t.Parallel()

	now := time.Unix(1111111111, 0)

	tests := []struct {
		name     string
		code     string
		last     int64
		wantStep int64
		wantOK   bool
	}{
		{"one step before", TOTPCode(rfcSecret, 37037036), 0, 37037036, true},
		{"current step", "050471", 0, 37037037, true},
		{"one step after", TOTPCode(rfcSecret, 37037038), 0, 37037038, true},
		{"two steps before", TOTPCode(rfcSecret, 37037035), 0, 0, false},
		{"replay of the last step", "050471", 37037037, 0, false},
		{"step above the last", TOTPCode(rfcSecret, 37037038), 37037037, 37037038, true},
		{"five digits", "05047", 0, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			step, ok := MatchTOTP(rfcSecret, tt.code, now, tt.last)
			if step != tt.wantStep || ok != tt.wantOK {
				t.Fatalf("MatchTOTP = %d, %v, want %d, %v", step, ok, tt.wantStep, tt.wantOK)
			}
		})
	}
}

func TestTOTPURI(t *testing.T) {
	t.Parallel()

	const encoded = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

	if got := EncodeTOTPSecret(rfcSecret); got != encoded {
		t.Fatalf("EncodeTOTPSecret = %s, want %s", got, encoded)
	}

	want := "otpauth://totp/equori:ann@example.com?secret=" + encoded + "&issuer=equori"
	if got := TOTPURI("ann@example.com", rfcSecret); got != want {
		t.Fatalf("TOTPURI = %s, want %s", got, want)
	}

	if n := len(NewTOTPSecret()); n != 20 {
		t.Fatalf("len(NewTOTPSecret()) = %d, want 20", n)
	}
}
