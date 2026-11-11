package server

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

func newDispatcher(pool *pgxpool.Pool, log *slog.Logger) *outbox.Dispatcher {
	return outbox.NewDispatcher(pool, log)
}

// wireOutbox registers the books of identity on the dispatcher.
func wireOutbox(dispatcher *outbox.Dispatcher, booksOf *identity.Module) {
	dispatcher.UseBooks(booksOf.InBooks)
}
