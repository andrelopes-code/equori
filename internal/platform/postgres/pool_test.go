package postgres

import "testing"

// A pool smaller than the work that holds a connection and asks for another one waits for itself;
// the size must not follow the number of CPUs of the host.
func TestPoolConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
		want int32
	}{
		{"default", "postgres://u:p@h:5432/d?sslmode=disable", 20},
		{"set in the url", "postgres://u:p@h:5432/d?sslmode=disable&pool_max_conns=7", 7},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			cfg, err := poolConfig(tc.url)
			if err != nil {
				t.Fatal(err)
			}

			if cfg.MaxConns != tc.want {
				t.Fatalf("MaxConns = %d, want %d", cfg.MaxConns, tc.want)
			}
		})
	}

	if _, err := poolConfig("postgres://u:p@h:5432/d?pool_max_conns=x"); err == nil {
		t.Fatal("an invalid pool_max_conns: want an error")
	}
}
