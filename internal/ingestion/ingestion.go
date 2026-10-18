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
	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

type Module struct {
	http *httpapi.Server
	svc  *app.Service
	log  *slog.Logger
}

type Config struct {
	// SecretKey and PreviousSecretKey are 32 raw bytes each (ADR 008); without SecretKey
	// integrations are unavailable.
	SecretKey, PreviousSecretKey string
	// PluggyURL is the only address Pluggy requests go to (N17).
	PluggyURL string
	Clock     clock.Clock
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, c *classification.Module, cfg Config, log *slog.Logger) (*Module, error) {
	in := app.Integrations{Now: cfg.Clock.Now, Today: cfg.Clock.Today}
	if cfg.SecretKey != "" {
		var previous []byte
		if cfg.PreviousSecretKey != "" {
			previous = []byte(cfg.PreviousSecretKey)
		}
		b, err := secret.New([]byte(cfg.SecretKey), previous)
		if err != nil {
			return nil, err
		}
		// A redirect would leave the configured address (N17).
		hc := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
		client, err := pluggy.NewClient(cfg.PluggyURL, hc, cfg.Clock.Now)
		if err != nil {
			return nil, err
		}
		in.Box, in.Aggregator = b, pluggyPort{sessions: pluggy.NewSessions(client), loc: cfg.Clock.Location()}
	}
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l, c}, in)
	dispatcher.Subscribe("ingestion", ledger.EventTransactionsPaired, followPairing)
	return &Module{http: httpapi.NewServer(svc, log), svc: svc, log: log}, nil
}

// SyncConnection syncs every mapped account of a connection now (P6 amendment A36).
func (m *Module) SyncConnection(ctx context.Context, userID int64, connectionID uuid.UUID) error {
	_, _, err := m.svc.SyncConnection(ctx, userID, connectionID)
	return err
}

// Tick syncs the connections whose item has new data and logs each failure by equori ids
// only (P6 amendments A43, A44).
func (m *Module) Tick(ctx context.Context) {
	failures, err := m.svc.Tick(ctx)
	for _, f := range failures {
		m.log.Warn("sync failed", "user_id", f.UserID, "connection_id", f.ConnectionID.String(), "error", f.Err.Error())
	}
	if err != nil && ctx.Err() == nil {
		m.log.Error("sync tick failed", "error", err.Error())
	}
}

// RunScheduler ticks now and then every interval until ctx ends.
func (m *Module) RunScheduler(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		m.Tick(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// RotateSecrets reseals every stored credential under the current key (ADR 008 K4) and
// returns how many changed.
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }

// followPairing runs in the dispatcher's transaction, so the records move with the delivery.
func followPairing(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p ledger.PairedEvent
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return app.NewService(postgres.NewTxRepository(tx), nil, app.Integrations{}).FollowPairing(ctx, e.UserID, p.Kept, p.RecordIDs)
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
	case errors.Is(err, ledger.ErrReconciled):
		return app.ErrReconciled
	}
	return err
}

func (p ledgerPort) posting(l app.Line) (ledger.ImportedPosting, error) {
	amount, err := money.New(l.Amount, l.Currency)
	return ledger.ImportedPosting{AccountID: l.AccountID, Date: l.Date, Amount: amount, Description: l.Description, Pending: l.Pending, DueDate: l.DueDate}, err
}

// importLine is a line as Classification decides it; aggregator lines carry Pluggy's category.
func importLine(posting ledger.ImportedPosting, l app.Line) classification.ImportLine {
	line := classification.ImportLine{AccountID: posting.AccountID, Date: posting.Date, Amount: posting.Amount, Description: posting.Description}
	if c := l.Category; c != nil {
		line.SourceCategory = &classification.LineCategory{Provider: string(domain.ProviderPluggy), ExternalID: c.ID, Name: c.Name}
	}
	return line
}

func (p ledgerPort) ImportTarget(ctx context.Context, userID int64, accountID uuid.UUID) (domain.ImportTarget, error) {
	t, err := p.l.ImportTarget(ctx, userID, accountID)
	if errors.Is(err, ledger.ErrValidation) {
		return domain.ImportTarget{}, &domain.FieldError{Field: "account_id", Message: "must be a balance account without sub-accounts"}
	}
	return domain.ImportTarget{Currency: t.Currency, Kind: t.Kind}, p.translate(err)
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
		decide[i] = importLine(posting, l.Line)
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
		matches[i] = ledger.Match{RecordID: m.RecordID, TransactionID: m.TransactionID, AccountID: m.AccountID, KeepPending: m.Pending}
	}
	conflicts, err := p.l.ClearMatchedBatch(ctx, userID, matches)
	return conflicts, p.translate(err)
}

func (p ledgerPort) AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error {
	return p.assert(ctx, userID, accountID, b, c, p.l.AssertBalance)
}

func (p ledgerPort) AssertSyncedBalance(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error {
	return p.assert(ctx, userID, accountID, b, c, p.l.AssertSyncedBalance)
}

func (p ledgerPort) AssertSyncedReserve(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error {
	return p.assert(ctx, userID, accountID, b, c, p.l.AssertSyncedReserve)
}

type assertFunc func(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) error

func (p ledgerPort) assert(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency, assert assertFunc) error {
	amount, err := money.New(b.Amount, c)
	if err != nil {
		return err
	}
	err = assert(ctx, userID, accountID, b.Date, amount)
	if errors.Is(err, ledger.ErrAlreadyReconciled) || errors.Is(err, ledger.ErrValidation) {
		return fmt.Errorf("%w: %w", app.ErrBalanceRejected, err)
	}
	return p.translate(err)
}

func (p ledgerPort) UpdateImportedPosting(ctx context.Context, userID int64, recordID uuid.UUID, pending bool, dueDate *time.Time) error {
	return p.translate(p.l.UpdateImportedPosting(ctx, userID, recordID, ledger.ImportedUpdate{Pending: pending, DueDate: dueDate}))
}

func (p ledgerPort) RecordInstallment(ctx context.Context, userID int64, l app.InstallmentLine) (uuid.UUID, uuid.UUID, error) {
	posting, err := p.posting(l.Line)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	decisions, err := p.c.DecideImport(ctx, userID, []classification.ImportLine{importLine(posting, l.Line)})
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	txID, planID, err := p.l.RecordImportedInstallment(ctx, userID, ledger.ImportedInstallment{
		RecordID: l.RecordID, CardAccountID: posting.AccountID, PurchaseDate: l.Installment.PurchaseDate, LineDate: posting.Date,
		DueDate: l.Line.DueDate, Description: posting.Description, Number: l.Installment.Number, Count: l.Installment.Count,
		Amount: posting.Amount.Neg(), Decision: decisions[0],
	})
	return txID, planID, p.installmentError(err)
}

func (p ledgerPort) LinkInstallment(ctx context.Context, userID int64, recordID, planID uuid.UUID, number int, l app.Line) (uuid.UUID, error) {
	posting, err := p.posting(l)
	if err != nil {
		return uuid.Nil, err
	}
	txID, err := p.l.LinkInstallment(ctx, userID, recordID, planID, number, posting.Amount.Neg())
	return txID, p.installmentError(err)
}

func (p ledgerPort) installmentError(err error) error {
	for _, refused := range []error{ledger.ErrInstallmentUnavailable, ledger.ErrAmountMismatch, ledger.ErrAlreadyMatched, ledger.ErrValidation} {
		if errors.Is(err, refused) {
			return fmt.Errorf("%w: %w", app.ErrInstallmentRefused, err)
		}
	}
	return p.translate(err)
}

func (p ledgerPort) ReleaseRecord(ctx context.Context, userID int64, recordID uuid.UUID) error {
	return p.translate(p.l.ReleaseRecord(ctx, userID, recordID))
}
