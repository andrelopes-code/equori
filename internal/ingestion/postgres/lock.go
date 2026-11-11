package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// LockAccountImports holds a session-level advisory lock on one pooled connection until the
// returned function runs, so that two imports of one account never process a record twice.
func (r *Repository) LockAccountImports(ctx context.Context, accountID uuid.UUID) (func(), error) {
	conn, err := r.pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}

	q := New(conn)
	if err := q.LockAccountImports(ctx, accountID.String()); err != nil {
		conn.Release()
		return nil, err
	}

	return func() {
		_ = q.UnlockAccountImports(context.WithoutCancel(ctx), accountID.String())

		conn.Release()
	}, nil
}

func (r *Repository) LockBookPairing(ctx context.Context, booksID int64) (func(), error) {
	conn, err := r.pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}

	key := fmt.Sprintf("books:%d:pairing", booksID)

	q := New(conn)
	if err := q.LockAccountImports(ctx, key); err != nil {
		conn.Release()
		return nil, err
	}

	return func() {
		_ = q.UnlockAccountImports(context.WithoutCancel(ctx), key)

		conn.Release()
	}, nil
}
