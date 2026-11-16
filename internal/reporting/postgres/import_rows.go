package postgres

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json/v2"
	"fmt"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// insert writes rows in one statement; a shared row already present is kept.
func insert(
	ctx context.Context,
	tx pgx.Tx,
	table string,
	rows [][]byte,
	booksID int64,
	shared bool,
) (int, error) {
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
			if shared {
				// A public row keeps no book; an own row takes the importing book (A236 D1).
				values[i] = "CASE WHEN r.books_id IS NULL THEN NULL ELSE $2::bigint END"
			}
		case laterReferences[table]:
			values[i] = "NULL"
		default:
			values[i] = "r." + pgx.Identifier{c}.Sanitize()
		}

		cols[i] = pgx.Identifier{c}.Sanitize()
	}

	if slices.ContainsFunc(values, func(v string) bool { return strings.Contains(v, "$2") }) {
		args = append(args, booksID)
	}

	name := pgx.Identifier{table}.Sanitize()

	sql := fmt.Sprintf(
		`INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%s, $1::jsonb) r`,
		name,
		strings.Join(cols, ", "),
		strings.Join(values, ", "),
		name,
	)
	if shared {
		sql += " ON CONFLICT DO NOTHING"
	}

	tag, err := tx.Exec(ctx, sql, args...)

	return int(tag.RowsAffected()), err
}

// foreignBook returns the column of table through which a row of rows names a row of
// another book, or "" when none does (A179). It reads single-column foreign keys whose
// referenced table has books_id; a reference to a row of the same import names no row yet.
func foreignBook(
	ctx context.Context,
	tx pgx.Tx,
	table string,
	rows [][]byte,
	booksID int64,
) (string, error) {
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
			pgx.Identifier{
				table,
			}.Sanitize(),
			k.ref, pgx.Identifier{k.refCol}.Sanitize(), pgx.Identifier{k.col}.Sanitize()),
			jsonArray(rows), booksID).
			Scan(&names); err != nil {
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
			return nil, fmt.Errorf(
				"%w: no file for attachment %s",
				app.ErrArchiveInvalid,
				blob.SHA256,
			)
		}

		field, err := json.Marshal(`\x` + hex.EncodeToString(content))
		if err != nil {
			return nil, err
		}

		out[i] = append(
			append(bytes.TrimSuffix(row, []byte("}")), `,"content":`...),
			append(field, '}')...)
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
