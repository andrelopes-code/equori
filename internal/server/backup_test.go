package server_test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os/exec"
	"path/filepath"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/server"
)

// compose runs a command in the database container that make check starts.
func compose(t *testing.T, stdin []byte, args ...string) []byte {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	base := []string{"compose", "-f", filepath.Join(root, "compose.yaml"), "-f", filepath.Join(root, "compose.dev.yaml"), "exec", "-T", "db"}
	cmd := exec.CommandContext(t.Context(), "docker", append(base, args...)...) //nolint:gosec // fixed binary; arguments built by the test
	cmd.Stdin = bytes.NewReader(stdin)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("docker %v: %v: %s", args, err, stderr.String())
	}
	return stdout.Bytes()
}

// snapshot is every fact a restore must reproduce: row counts of all tables, balances,
// the derived daily series and the triggers that enforce the invariants.
func snapshot(t *testing.T, pool *pgxpool.Pool) []string {
	t.Helper()
	ctx := t.Context()
	var out []string
	rows, err := pool.Query(ctx, `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)
	if err != nil {
		t.Fatal(err)
	}
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		tables = append(tables, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	queries := []string{
		`SELECT account_id::text || ' ' || sum(amount) FROM ledger_posting WHERE NOT voided GROUP BY account_id ORDER BY 1`,
		`SELECT account_id::text || ' ' || date || ' ' || balance_booked || ' ' || balance_settled FROM reporting_account_day ORDER BY 1`,
		`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1`,
		`SELECT encode(sha256, 'hex') || ' ' || encode(sha256(content), 'hex') FROM ledger_attachment_blob ORDER BY 1`,
	}
	for _, table := range tables {
		queries = append(queries, fmt.Sprintf(`SELECT '%s ' || count(*) FROM %q`, table, table))
	}
	for _, q := range queries {
		rows, err := pool.Query(ctx, q)
		if err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		for rows.Next() {
			var line string
			if err := rows.Scan(&line); err != nil {
				t.Fatal(err)
			}
			out = append(out, line)
		}
		if err := rows.Err(); err != nil {
			t.Fatal(err)
		}
	}
	return out
}

// N12: a dump restored into an empty database reproduces every fact and every derived value.
func TestRestoredBackupMatchesTheOriginal(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-20"))
	checking := h.Account("Nubank", "asset", "checking", nil)
	reserve := h.Account("Emergency fund", "asset", "reserve", nil)
	food := h.Account("Food", "expense", "", nil)
	salary := h.Account("Salary", "income", "", nil)
	card := h.Card("Itaú Visa", 3, 10, "next")
	h.Record("2026-10-01", apitest.Posting(checking, 500000), apitest.Posting(salary, -500000))
	h.Record("2026-10-02", apitest.Posting(checking, -100000), apitest.Posting(reserve, 100000))
	groceries := h.Record("2026-10-14", apitest.Posting(card, -23000), apitest.Posting(food, 23000))
	duplicate := h.Record("2026-10-15", apitest.Posting(checking, -500), apitest.Posting(food, 500))
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+duplicate+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+reserve+"/balance-assertions", map[string]any{"date": "2026-10-31", "amount": apitest.BRL(100841)}, http.StatusCreated, nil)
	if r := h.Upload("/api/v1/transactions/"+groceries+"/attachments", "receipt.pdf", append([]byte("%PDF-1.7\n"), bytes.Repeat([]byte("x"), 4096)...)); r.Status != http.StatusCreated {
		t.Fatalf("upload: %d %s", r.Status, r.Body)
	}
	h.Dispatch()
	want := snapshot(t, h.Pool)

	dump := compose(t, nil, "pg_dump", "-U", "equori", "-Fc", "-d", h.Pool.Config().ConnConfig.Database)
	restored := pgtest.Empty(t)
	compose(t, dump, "pg_restore", "-U", "equori", "--no-owner", "--exit-on-error", "-d", restored.Config().ConnConfig.Database)

	if got := snapshot(t, restored); !slices.Equal(got, want) {
		t.Fatalf("restored database differs:\n got %v\nwant %v", got, want)
	}
	app, err := server.New(restored, server.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	if err := app.Reporting.RebuildAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := snapshot(t, restored); !slices.Equal(got, want) {
		t.Fatalf("derived tables rebuilt on the restored database differ:\n got %v\nwant %v", got, want)
	}
}
