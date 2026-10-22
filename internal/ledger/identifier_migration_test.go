package ledger_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Spec §5.7: migration 45 moves each ISPB to the br_ispb identifier.
func TestInstitutionISPBBecomesIdentifier(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 44, log); err != nil {
		t.Fatal(err)
	}
	uid := pgtest.CreateUser(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO ledger_institution (user_id, name, ispb) VALUES ($1, 'Banco do Brasil', '00000000'), ($1, 'BB', '00360305'), ($1, 'Wallet', NULL)`, uid); err != nil {
		t.Fatal(err)
	}
	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}
	rows, err := pool.Query(ctx, `SELECT name, identifier_scheme, identifier FROM ledger_institution WHERE user_id = $1 ORDER BY name`, uid)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	type row struct{ name, scheme, identifier string }
	var got []row
	for rows.Next() {
		var name string
		var scheme, identifier *string
		if err := rows.Scan(&name, &scheme, &identifier); err != nil {
			t.Fatal(err)
		}
		r := row{name: name}
		if scheme != nil && identifier != nil {
			r.scheme, r.identifier = *scheme, *identifier
		}
		got = append(got, r)
	}
	want := []row{{"BB", "br_ispb", "00360305"}, {"Banco do Brasil", "br_ispb", "00000000"}, {"Wallet", "", ""}}
	if len(got) != len(want) {
		t.Fatalf("rows = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("row %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}
