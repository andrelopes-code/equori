// Package ingestion imports external data into the ledger: files now, aggregators later
// (chapter 4, 4.3.3). It reaches the ledger only through package ledger.
package ingestion

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

type Module struct {
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, c *classification.Module, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l, c})
	dispatcher.Subscribe("ingestion", ledger.EventTransactionsPaired, followPairing)
	return &Module{http: httpapi.NewServer(svc, log)}
}

// followPairing runs in the dispatcher's transaction, so the records move with the delivery.
func followPairing(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p ledger.PairedEvent
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return app.NewService(postgres.NewTxRepository(tx), nil).FollowPairing(ctx, e.UserID, p.Kept, p.RecordIDs)
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of file imports: 10 MiB of content plus the
// multipart framing (P4 amendment A16).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/accounts/{id}/imports", Bytes: 11 << 20}}
}

// ledgerPort adapts package ledger to the port app.Ledger, translating its errors.
// ledgerPort records lines in the ledger after Classification decides them (P5 amendment A19).
type ledgerPort struct {
	l *ledger.Module
	c *classification.Module
}

func (p ledgerPort) translate(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, ledger.ErrNotFound):
		return app.ErrNotFound
	case errors.Is(err, ledger.ErrAlreadyMatched):
		return app.ErrAlreadyMatched
	}
	return err
}

func (p ledgerPort) posting(l app.Line) (ledger.ImportedPosting, error) {
	amount, err := money.New(l.Amount, l.Currency)
	return ledger.ImportedPosting{AccountID: l.AccountID, Date: l.Date, Amount: amount, Description: l.Description}, err
}

func (p ledgerPort) ImportCurrency(ctx context.Context, userID int64, accountID uuid.UUID) (money.Currency, error) {
	c, err := p.l.ImportCurrency(ctx, userID, accountID)
	if errors.Is(err, ledger.ErrValidation) {
		return "", &domain.FieldError{Field: "account_id", Message: "must be a balance account without sub-accounts"}
	}
	return c, p.translate(err)
}

func (p ledgerPort) LinkedTransaction(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, bool, error) {
	id, imported, err := p.l.LinkedTransaction(ctx, userID, recordID)
	return id, imported, p.translate(err)
}

func (p ledgerPort) RecordImported(ctx context.Context, userID int64, lines []app.NewLine) ([]uuid.UUID, error) {
	recs := make([]ledger.ImportedRecord, len(lines))
	decide := make([]classification.ImportLine, len(lines))
	for i, l := range lines {
		posting, err := p.posting(l.Line)
		if err != nil {
			return nil, err
		}
		recs[i] = ledger.ImportedRecord{RecordID: l.RecordID, Posting: posting}
		decide[i] = classification.ImportLine{AccountID: posting.AccountID, Date: posting.Date, Amount: posting.Amount, Description: posting.Description}
	}
	decisions, err := p.c.DecideImport(ctx, userID, decide)
	if err != nil {
		return nil, err
	}
	for i := range recs {
		recs[i].Decision = decisions[i]
	}
	ids, err := p.l.RecordImportedBatch(ctx, userID, recs)
	if le, ok := errors.AsType[*ledger.LineError](err); ok {
		return nil, &app.RejectedLine{Index: le.Index, Reason: le.Err}
	}
	return ids, p.translate(err)
}

func (p ledgerPort) UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]domain.LedgerPosting, error) {
	ps, err := p.l.UnlinkedPostings(ctx, userID, accountID, from, to)
	out := make([]domain.LedgerPosting, len(ps))
	for i, x := range ps {
		out[i] = domain.LedgerPosting{TransactionID: x.TransactionID, Date: x.Date, Amount: x.Amount}
	}
	return out, p.translate(err)
}

func (p ledgerPort) ClearMatched(ctx context.Context, userID int64, ms []app.Match) ([]int, error) {
	matches := make([]ledger.Match, len(ms))
	for i, m := range ms {
		matches[i] = ledger.Match{RecordID: m.RecordID, TransactionID: m.TransactionID, AccountID: m.AccountID}
	}
	conflicts, err := p.l.ClearMatchedBatch(ctx, userID, matches)
	return conflicts, p.translate(err)
}

func (p ledgerPort) AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error {
	amount, err := money.New(b.Amount, c)
	if err != nil {
		return err
	}
	err = p.l.AssertBalance(ctx, userID, accountID, b.Date, amount)
	if errors.Is(err, ledger.ErrAlreadyReconciled) || errors.Is(err, ledger.ErrValidation) {
		return fmt.Errorf("%w: %w", app.ErrBalanceRejected, err)
	}
	return p.translate(err)
}
