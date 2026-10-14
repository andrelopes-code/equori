package postgres_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestMigrate(t *testing.T) {
	pool := pgtest.New(t)

	if err := pool.Ping(t.Context()); err != nil {
		t.Fatalf("ping migrated database: %v", err)
	}
}
