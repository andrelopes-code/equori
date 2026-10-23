package ingestion_test

import (
	"bytes"
	"crypto/sha256"
	"io"
	"log/slog"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Migration 54: migration 48 renamed the batch source open_finance to aggregator, and the
// dedup key of a line with an external id hashes the source. Keys stored before 48 must match
// the keys of the current code, or the next sync imports every stored line again.
func TestDedupKeyMigration(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 53, log); err != nil {
		t.Fatal(err)
	}
	uid := pgtest.CreateUser(t, pool)
	var account, syncBatch, fileBatch uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on) VALUES ($1, 'Nubank', 'asset', 'checking', 'BRL', '2026-01-01') RETURNING id`, uid).Scan(&account); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency) VALUES ($1, $2, 'aggregator', NULL, 'BRL') RETURNING id`, uid, account).Scan(&syncBatch); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency) VALUES ($1, $2, 'ofx', 'extrato.ofx', 'BRL') RETURNING id`, uid, account).Scan(&fileBatch); err != nil {
		t.Fatal(err)
	}
	legacy := func(source, externalID string) []byte {
		sum := sha256.Sum256([]byte(account.String() + "\x00" + source + "\x00id\x00" + externalID))
		return sum[:]
	}
	day := "2026-10-08"
	lines := []struct {
		batch      uuid.UUID
		externalID string
		key        []byte
		source     domain.Source
	}{
		{syncBatch, "pluggy-1", legacy("open_finance", "pluggy-1"), domain.SourceAggregator},
		{fileBatch, "fitid-1", legacy("ofx", "fitid-1"), domain.SourceOFX},
	}
	for _, l := range lines {
		if _, err := pool.Exec(ctx, `INSERT INTO ingestion_external_record (user_id, batch_id, account_id, external_id, dedup_key, raw, booked_on, amount, description)
			VALUES ($1, $2, $3, $4, $5, '{}', $6, -100, 'Padaria')`, uid, l.batch, account, l.externalID, l.key, day); err != nil {
			t.Fatal(err)
		}
	}
	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}
	for _, l := range lines {
		var got []byte
		if err := pool.QueryRow(ctx, `SELECT dedup_key FROM ingestion_external_record WHERE external_id = $1`, l.externalID).Scan(&got); err != nil {
			t.Fatal(err)
		}
		want := domain.DedupKey(account, l.source, domain.NormalizedRecord{ExternalID: l.externalID}, 0)
		if !bytes.Equal(got, want) {
			t.Errorf("%s: dedup_key = %x; want %x", l.externalID, got, want)
		}
	}
}
