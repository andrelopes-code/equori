package postgres

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json/v2"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

var _ app.ImportRepository = (*Exports)(nil)

func (r *Exports) ImportableTables(ctx context.Context) ([]string, error) {
	facts, err := FactTables(ctx, r.pool)
	if err != nil {
		return nil, err
	}

	return append(append(facts, sharedTables...), "ledger_transaction_version"), nil
}

// laterReferences close a cycle of foreign keys: the column is inserted empty and set by an
// UPDATE after every table is written.
var laterReferences = map[string]string{
	// A statement financed by a plan, whose plan starts on another statement.
	"ledger_statement": "financed_by_plan_id",
}

// loadOrder sorts tables so that a table follows every table it references, but through a
// later reference; a reference of a table to itself is checked at the end of its one INSERT.
func loadOrder(ctx context.Context, q DBTX, tables []string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT conrelid::regclass::text, confrelid::regclass::text,
			ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = conrelid AND attnum = ANY (conkey))
		FROM pg_constraint WHERE contype = 'f' AND conrelid <> confrelid`)
	if err != nil {
		return nil, err
	}

	type edge struct{ from, to string }

	all, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (edge, error) {
		var e edge

		var cols []string
		if err := row.Scan(&e.from, &e.to, &cols); err != nil {
			return e, err
		}

		if slices.Contains(cols, laterReferences[e.from]) {
			e.to = ""
		}

		return e, nil
	})
	if err != nil {
		return nil, err
	}

	edges := slices.DeleteFunc(all, func(e edge) bool { return e.to == "" })
	pending := slices.Sorted(slices.Values(tables))

	var out []string
	for len(pending) > 0 {
		i := slices.IndexFunc(pending, func(t string) bool {
			return !slices.ContainsFunc(edges, func(e edge) bool { return e.from == t && slices.Contains(pending, e.to) })
		})
		if i < 0 {
			return nil, fmt.Errorf("foreign keys form a cycle among %v", pending)
		}

		out = append(out, pending[i])
		pending = slices.Delete(pending, i, i+1)
	}

	return out, nil
}

// columns returns the columns of table an INSERT may write, in table order.
func columns(ctx context.Context, q DBTX, table string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT column_name FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = $1 AND is_generated = 'NEVER' AND is_identity = 'NO'
		ORDER BY ordinal_position`, table)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowTo[string])
}

func (r *Exports) Import(ctx context.Context, booksID int64, tables []app.ArchiveTable, attachments map[string][]byte, credentials map[uuid.UUID][]byte) ([]app.TableCount, int, error) {
	var counts []app.TableCount

	restored := 0
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		var holds bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM ledger_transaction WHERE books_id = $1)
			OR EXISTS (SELECT 1 FROM ledger_account WHERE books_id = $1 AND system_role IS NULL)`, booksID).Scan(&holds); err != nil {
			return err
		}

		if holds {
			return app.ErrImportNotEmpty
		}

		facts, err := FactTables(ctx, tx)
		if err != nil {
			return err
		}

		all, err := r.ImportableTables(ctx)
		if err != nil {
			return err
		}

		order, err := loadOrder(ctx, tx, all)
		if err != nil {
			return err
		}

		// The sign-up rows (system accounts, settings) give way to the archive's.
		for _, t := range slices.Backward(order) {
			where := "books_id = $1"
			switch {
			case t == "ledger_transaction_version":
				where = "transaction_id IN (SELECT id FROM ledger_transaction WHERE books_id = $1)"
			case !slices.Contains(facts, t):
				continue
			}

			if _, err := tx.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE %s`, pgx.Identifier{t}.Sanitize(), where), booksID); err != nil {
				return fmt.Errorf("clear %s: %w", t, err)
			}
		}

		byName := map[string]app.ArchiveTable{}
		for _, t := range tables {
			byName[t.Name] = t
		}

		for _, t := range order {
			rows := byName[t].Rows
			if len(rows) == 0 {
				continue
			}

			if t == "ledger_attachment_blob" {
				if rows, err = withContent(rows, attachments); err != nil {
					return err
				}
			}

			col, err := foreignBook(ctx, tx, t, rows, booksID)
			if err != nil {
				return fmt.Errorf("check %s: %w", t, err)
			}

			if col != "" {
				return fmt.Errorf("%w: %s.%s", app.ErrImportConflict, t, col)
			}

			n, err := insert(ctx, tx, t, rows, booksID, slices.Contains(sharedTables, t))
			if err != nil {
				return fmt.Errorf("import %s: %w", t, err)
			}

			counts = append(counts, app.TableCount{Name: t, Rows: n})
		}

		for t, c := range laterReferences {
			rows := byName[t].Rows
			if len(rows) == 0 {
				continue
			}

			name, col := pgx.Identifier{t}.Sanitize(), pgx.Identifier{c}.Sanitize()
			if _, err := tx.Exec(ctx, fmt.Sprintf(`UPDATE %s t SET %s = r.%s FROM jsonb_populate_recordset(NULL::%s, $1::jsonb) r
				WHERE t.books_id = $2 AND t.id = r.id AND r.%s IS NOT NULL`, name, col, col, name, col), jsonArray(rows), booksID); err != nil {
				return fmt.Errorf("import %s.%s: %w", t, c, err)
			}
		}

		// Export design C6: a credential of an id with no imported integration matches no row.
		for id, sealed := range credentials {
			tag, err := tx.Exec(ctx, `UPDATE ingestion_integration SET credential_ciphertext = $1 WHERE books_id = $2 AND id = $3`, sealed, booksID, id)
			if err != nil {
				return fmt.Errorf("restore credential: %w", err)
			}

			restored += int(tag.RowsAffected())
		}

		return nil
	})

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return nil, 0, fmt.Errorf("%w: %s", app.ErrImportConflict, pgErr.ConstraintName)
	}

	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return nil, 0, fmt.Errorf("%w: %s", app.ErrArchiveInvalid, pgErr.ConstraintName)
	}

	return counts, restored, err
}

// insert writes rows in one statement; a shared row already present is kept.
func insert(ctx context.Context, tx pgx.Tx, table string, rows [][]byte, booksID int64, shared bool) (int, error) {
	cols, err := columns(ctx, tx, table)
	if err != nil {
		return 0, err
	}

	values := make([]string, len(cols))
	args := []any{jsonArray(rows)}

	for i, c := range cols {
		switch c {
		case "books_id":
			values[i] = "$2::bigint"
		case laterReferences[table]:
			values[i] = "NULL"
		default:
			values[i] = "r." + pgx.Identifier{c}.Sanitize()
		}

		cols[i] = pgx.Identifier{c}.Sanitize()
	}

	if slices.Contains(values, "$2::bigint") {
		args = append(args, booksID)
	}

	name := pgx.Identifier{table}.Sanitize()

	sql := fmt.Sprintf(`INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%s, $1::jsonb) r`,
		name, strings.Join(cols, ", "), strings.Join(values, ", "), name)
	if shared {
		sql += " ON CONFLICT DO NOTHING"
	}

	tag, err := tx.Exec(ctx, sql, args...)

	return int(tag.RowsAffected()), err
}

// foreignBook returns the column of table through which a row of rows names a row of
// another book, or "" when none does (A179). It reads single-column foreign keys whose
// referenced table has books_id; a reference to a row of the same import names no row yet.
func foreignBook(ctx context.Context, tx pgx.Tx, table string, rows [][]byte, booksID int64) (string, error) {
	keys, err := tx.Query(ctx, `SELECT a.attname::text, c.confrelid::regclass::text, f.attname::text
		FROM pg_constraint c
		JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
		JOIN pg_attribute f ON f.attrelid = c.confrelid AND f.attnum = c.confkey[1]
		WHERE c.contype = 'f' AND c.conrelid = $1::regclass AND cardinality(c.conkey) = 1
			AND EXISTS (SELECT 1 FROM pg_attribute b
				WHERE b.attrelid = c.confrelid AND b.attname = 'books_id' AND NOT b.attisdropped)
		ORDER BY 1`, pgx.Identifier{table}.Sanitize())
	if err != nil {
		return "", err
	}

	type key struct{ col, ref, refCol string }

	found, err := pgx.CollectRows(keys, func(row pgx.CollectableRow) (key, error) {
		var k key

		return k, row.Scan(&k.col, &k.ref, &k.refCol)
	})
	if err != nil {
		return "", err
	}

	for _, k := range found {
		var names bool
		if err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::%s, $1::jsonb) r
			JOIN %s x ON x.%s = r.%s WHERE x.books_id <> $2)`,
			pgx.Identifier{table}.Sanitize(), k.ref, pgx.Identifier{k.refCol}.Sanitize(), pgx.Identifier{k.col}.Sanitize()),
			jsonArray(rows), booksID).Scan(&names); err != nil {
			return "", err
		}

		if names {
			return k.col, nil
		}
	}

	return "", nil
}

func jsonArray(rows [][]byte) []byte {
	return append(append([]byte("["), bytes.Join(rows, []byte(","))...), ']')
}

// withContent puts the bytes of each attachment back into its blob row.
func withContent(rows [][]byte, attachments map[string][]byte) ([][]byte, error) {
	out := make([][]byte, len(rows))
	for i, row := range rows {
		var blob struct {
			SHA256 string `json:"sha256"`
		}
		if err := json.Unmarshal(row, &blob); err != nil {
			return nil, fmt.Errorf("%w: blob row", app.ErrArchiveInvalid)
		}

		content, ok := attachments[strings.TrimPrefix(blob.SHA256, `\x`)]
		if !ok {
			return nil, fmt.Errorf("%w: no file for attachment %s", app.ErrArchiveInvalid, blob.SHA256)
		}

		field, err := json.Marshal(`\x` + hex.EncodeToString(content))
		if err != nil {
			return nil, err
		}

		out[i] = append(append(bytes.TrimSuffix(row, []byte("}")), `,"content":`...), append(field, '}')...)
	}

	return out, nil
}
