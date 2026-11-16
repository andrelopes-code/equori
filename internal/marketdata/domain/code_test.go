package domain

import (
	"regexp"
	"testing"

	"github.com/google/uuid"
)

func TestOwnCode(t *testing.T) {
	cases := []struct {
		name string
		app  string
		want string
	}{
		{"first application", "0192f3a4-5b6c-7d8e-9f00-112233445566", "RF.280302.CS3YS"},
		{"next application", "0192f3a4-5b6c-7d8e-9f00-112233445567", "RF.280302.6DAHD"},
	}
	pattern := regexp.MustCompile(`^[A-Z0-9.]{2,20}$`)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := uuid.MustParse(tc.app)

			got := OwnCode(date("2028-03-02"), app)

			if string(got) != tc.want {
				t.Fatalf("code = %q, want %q", got, tc.want)
			}

			if again := OwnCode(date("2028-03-02"), app); again != got {
				t.Fatalf("second call = %q, want %q", again, got)
			}

			if !pattern.MatchString(string(got)) {
				t.Fatalf("code %q does not match %s", got, pattern)
			}
		})
	}
}
