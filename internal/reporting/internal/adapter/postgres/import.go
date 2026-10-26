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

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

var _ app.ImportRepository = (*Exports)(nil)

func (r *Exports) SchemaVersion(ctx context.Context) (int64, error) {
	var v int64
	err := r.pool.QueryRow(ctx, `SELECT max(version_id) FROM goose_db_version WHERE is_applied`).Scan(&v)
	return v, err
}

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

func (r *Exports) Import(ctx context.Context, userID int64, tables []app.ArchiveTable, attachments map[string][]byte) ([]app.TableCount, error) {
	var counts []app.TableCount
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		var holds bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM ledger_transaction WHERE user_id = $1)
			OR EXISTS (SELECT 1 FROM ledger_account WHERE user_id = $1 AND system_role IS NULL)`, userID).Scan(&holds); err != nil {
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
			where := "user_id = $1"
			switch {
			case t == "ledger_transaction_version":
				where = "transaction_id IN (SELECT id FROM ledger_transaction WHERE user_id = $1)"
			case !slices.Contains(facts, t):
				continue
			}
			if _, err := tx.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE %s`, pgx.Identifier{t}.Sanitize(), where), userID); err != nil {
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
			n, err := insert(ctx, tx, t, rows, userID, slices.Contains(sharedTables, t))
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
				WHERE t.user_id = $2 AND t.id = r.id AND r.%s IS NOT NULL`, name, col, col, name, col), jsonArray(rows), userID); err != nil {
				return fmt.Errorf("import %s.%s: %w", t, c, err)
			}
		}
		return nil
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return nil, fmt.Errorf("%w: %s", app.ErrImportConflict, pgErr.ConstraintName)
	}
	return counts, err
}

// insert writes rows in one statement; a shared row already present is kept.
func insert(ctx context.Context, tx pgx.Tx, table string, rows [][]byte, userID int64, shared bool) (int, error) {
	cols, err := columns(ctx, tx, table)
	if err != nil {
		return 0, err
	}
	values := make([]string, len(cols))
	args := []any{jsonArray(rows)}
	for i, c := range cols {
		switch c {
		case "user_id":
			values[i] = "$2::bigint"
		case laterReferences[table]:
			values[i] = "NULL"
		default:
			values[i] = "r." + pgx.Identifier{c}.Sanitize()
		}
		cols[i] = pgx.Identifier{c}.Sanitize()
	}
	if slices.Contains(values, "$2::bigint") {
		args = append(args, userID)
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
