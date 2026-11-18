package postgres

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/reporting/app"
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
			return !slices.ContainsFunc(
				edges,
				func(e edge) bool { return e.from == t && slices.Contains(pending, e.to) },
			)
		})
		if i < 0 {
			return nil, fmt.Errorf("foreign keys form a cycle among %v", pending)
		}

		out = append(out, pending[i])
		pending = slices.Delete(pending, i, i+1)
	}

	return out, nil
}

func (r *Exports) Import(
	ctx context.Context,
	booksID int64,
	tables []app.ArchiveTable,
	attachments map[string][]byte,
	sealed app.SealedCredentials,
	replace string,
) ([]app.TableCount, app.RestoredCredentials, error) {
	var counts []app.TableCount

	var restored app.RestoredCredentials
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		if err := clearable(ctx, tx, booksID, replace); err != nil {
			return err
		}

		facts, order, err := r.importOrder(ctx, tx)
		if err != nil {
			return err
		}

		if err := clearFacts(ctx, tx, booksID, order, facts); err != nil {
			return err
		}

		byName := map[string]app.ArchiveTable{}
		for _, t := range tables {
			byName[t.Name] = t
		}

		counts, err = insertTables(ctx, tx, booksID, order, byName, attachments)
		if err != nil {
			return err
		}

		if err := setLaterReferences(ctx, tx, booksID, byName); err != nil {
			return err
		}

		restored, err = restoreSecrets(ctx, tx, booksID, sealed)

		return err
	})

	if mapped := importConflict(err); mapped != nil {
		return nil, app.RestoredCredentials{}, mapped
	}

	return counts, restored, err
}

func (r *Exports) importOrder(ctx context.Context, tx pgx.Tx) ([]string, []string, error) {
	facts, err := FactTables(ctx, tx)
	if err != nil {
		return nil, nil, err
	}

	all, err := r.ImportableTables(ctx)
	if err != nil {
		return nil, nil, err
	}

	order, err := loadOrder(ctx, tx, all)

	return facts, order, err
}

// importConflict maps the unique and foreign key violations of an import; nil for any other error.
func importConflict(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return fmt.Errorf("%w: %s", app.ErrImportConflict, pgErr.ConstraintName)
	}

	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return fmt.Errorf("%w: %s", app.ErrArchiveInvalid, pgErr.ConstraintName)
	}

	return nil
}

// clearFacts deletes the sign-up rows (system accounts, settings), which give way to the archive's.
func clearFacts(ctx context.Context, tx pgx.Tx, booksID int64, order, facts []string) error {
	for _, t := range slices.Backward(order) {
		where := "books_id = $1"
		switch {
		case t == "ledger_transaction_version":
			where = "transaction_id IN (SELECT id FROM ledger_transaction WHERE books_id = $1)"
		case !slices.Contains(facts, t):
			continue
		}

		if _, err := tx.Exec(
			ctx,
			fmt.Sprintf(`DELETE FROM %s WHERE %s`, pgx.Identifier{t}.Sanitize(), where),
			booksID,
		); err != nil {
			return fmt.Errorf("clear %s: %w", t, err)
		}
	}

	return nil
}

func insertTables(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	order []string,
	byName map[string]app.ArchiveTable,
	attachments map[string][]byte,
) ([]app.TableCount, error) {
	var counts []app.TableCount

	for _, t := range order {
		rows := byName[t].Rows
		if len(rows) == 0 {
			continue
		}

		var err error
		if t == "ledger_attachment_blob" {
			if rows, err = withContent(rows, attachments); err != nil {
				return counts, err
			}
		}

		col, err := foreignBook(ctx, tx, t, rows, booksID)
		if err != nil {
			return counts, fmt.Errorf("check %s: %w", t, err)
		}

		if col != "" {
			return counts, fmt.Errorf("%w: %s.%s", app.ErrImportConflict, t, col)
		}

		n, err := insert(ctx, tx, t, rows, booksID, slices.Contains(sharedTables, t))
		if err != nil {
			return counts, fmt.Errorf("import %s: %w", t, err)
		}

		counts = append(counts, app.TableCount{Name: t, Rows: n})
	}

	return counts, nil
}

func setLaterReferences(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	byName map[string]app.ArchiveTable,
) error {
	for t, c := range laterReferences {
		rows := byName[t].Rows
		if len(rows) == 0 {
			continue
		}

		name, col := pgx.Identifier{t}.Sanitize(), pgx.Identifier{c}.Sanitize()
		if _, err := tx.Exec(
			ctx,
			fmt.Sprintf(
				`UPDATE %s t SET %s = r.%s FROM jsonb_populate_recordset(NULL::%s, $1::jsonb) r
			WHERE t.books_id = $2 AND t.id = r.id AND r.%s IS NOT NULL`,
				name,
				col,
				col,
				name,
				col,
			),
			jsonArray(rows),
			booksID,
		); err != nil {
			return fmt.Errorf("import %s.%s: %w", t, c, err)
		}
	}

	return nil
}

func restoreSecrets(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	sealed app.SealedCredentials,
) (app.RestoredCredentials, error) {
	var restored app.RestoredCredentials

	// Export design C6: a credential of an id with no imported integration matches no row.
	for id, b := range sealed.Integrations {
		tag, err := tx.Exec(
			ctx,
			`UPDATE ingestion_integration SET credential_ciphertext = $1 WHERE books_id = $2 AND id = $3`,
			b,
			booksID,
			id,
		)
		if err != nil {
			return restored, fmt.Errorf("restore credential: %w", err)
		}

		restored.Integrations += int(tag.RowsAffected())
	}

	// Export design T5: a key of an id with no imported provider matches no row.
	for id, b := range sealed.Providers {
		tag, err := tx.Exec(
			ctx,
			`UPDATE assistant_provider SET sealed_key = $1 WHERE books_id = $2 AND id = $3`,
			b,
			booksID,
			id,
		)
		if err != nil {
			return restored, fmt.Errorf("restore provider key: %w", err)
		}

		restored.Providers += int(tag.RowsAffected())
	}

	return restored, nil
}

// replacedTables hold rows that no archive carries and that a replacement deletes, child
// tables first (export design R3).
var replacedTables = []string{
	"assistant_proposal",
	"assistant_message",
	"assistant_conversation_file",
	"assistant_conversation",
	"assistant_usage",
}

// clearable refuses an import into a book that holds facts, unless replace repeats the book
// name; then it deletes the rows of replacedTables and unlocks the reconciled postings for the
// deletes of Import (export design E4 step 2, R2, R3).
func clearable(ctx context.Context, tx pgx.Tx, booksID int64, replace string) error {
	if replace == "" {
		var holds bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM ledger_transaction WHERE books_id = $1)
			OR EXISTS (SELECT 1 FROM ledger_account WHERE books_id = $1 AND system_role IS NULL)`, booksID).
			Scan(&holds); err != nil {
			return err
		}

		if holds {
			return app.ErrImportNotEmpty
		}

		return nil
	}

	var name string
	if err := tx.QueryRow(ctx, `SELECT coalesce(name, '') FROM identity_books WHERE id = $1`, booksID).
		Scan(&name); err != nil {
		return err
	}

	if name != replace {
		return app.ErrConfirmationMismatch
	}

	for _, t := range replacedTables {
		if _, err := tx.Exec(
			ctx,
			fmt.Sprintf(`DELETE FROM %s WHERE books_id = $1`, pgx.Identifier{t}.Sanitize()),
			booksID,
		); err != nil {
			return fmt.Errorf("clear %s: %w", t, err)
		}
	}

	_, err := tx.Exec(ctx, `SELECT set_config('equori.unlock_reconciled', 'on', TRUE)`)

	return err
}
