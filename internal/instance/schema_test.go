package instance_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestSchemaInvariants(t *testing.T) {
	t.Parallel()

	pool := pgtest.New(t)
	ctx := t.Context()

	if _, err := pool.Exec(ctx, `INSERT INTO instance_settings DEFAULT VALUES`); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		sql  string
	}{
		{"the row id is true", `INSERT INTO instance_settings (id) VALUES (false)`},
		{"a copy state from the list", `INSERT INTO instance_settings (copy_state) VALUES ('other')`},
		{"at most one row", `INSERT INTO instance_settings DEFAULT VALUES`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if _, err := pool.Exec(ctx, tt.sql); err == nil {
				t.Fatalf("%s: the database accepted it", tt.sql)
			}
		})
	}
}
