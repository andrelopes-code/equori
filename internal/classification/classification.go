// Package classification decides categories with rules, payee aliases and payee history (docs/domain, 4.3.2).
// It is the only entry point to the module for the rest of the application.
package classification

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

	"github.com/andrelopes-code/equori/internal/classification/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/classification/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/classification/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	ledger *ledger.Module
}

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "classification"

// eventTypes maps the ledger events Classification reacts to (F5, P5 amendment A20).
var eventTypes = map[string]string{
	ledger.EventTransactionRecorded:    app.EventRecorded,
	ledger.EventTransactionCorrected:   app.EventCorrected,
	ledger.EventTransactionCategorized: app.EventCategorized,
	ledger.EventTransactionVoided:      app.EventVoided,
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, log *slog.Logger) *Module {
	port := ledgerPort{l}
	svc := app.NewService(postgres.NewRepository(pool), port)
	for _, ledgerType := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionCategorized, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, ledgerType, port.handle)
	}
	dispatcher.Subscribe(consumer, ledger.EventCategoriesMerged, port.handleMerge)
	dispatcher.Subscribe(consumer, ledger.EventPayeesMerged, port.handlePayeeMerge)
	dispatcher.Subscribe(consumer, ledger.EventTagRenamed, port.handleTagRename)
	return &Module{http: httpapi.NewServer(svc, log), svc: svc, ledger: l}
}

// handleMerge follows a category merge in the dispatcher's transaction (A75).
func (p ledgerPort) handleMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.CategoriesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return app.NewService(postgres.NewTxRepository(tx), p).HandleCategoriesMerged(ctx, e.UserID, payload.From, payload.Into)
}

// handlePayeeMerge follows a payee merge in the dispatcher's transaction (A82).
func (p ledgerPort) handlePayeeMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.PayeesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return app.NewService(postgres.NewTxRepository(tx), p).HandlePayeesMerged(ctx, e.UserID, payload.From, payload.Into)
}

// handleTagRename follows a tag rename or merge in the dispatcher's transaction.
func (p ledgerPort) handleTagRename(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TagRenamed
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return app.NewService(postgres.NewTxRepository(tx), p).HandleTagRenamed(ctx, e.UserID, payload.From, payload.Into)
}

// handle runs in the dispatcher's transaction, so the record commits with the delivery.
func (p ledgerPort) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	date, err := time.Parse(time.DateOnly, payload.Date)
	if err != nil {
		return fmt.Errorf("%s date: %w", e.Type, err)
	}
	event := app.Event{
		Type: eventTypes[e.Type], UserID: e.UserID, TransactionID: payload.TransactionID, Version: payload.Version, Date: date,
		Origin: payload.Origin, CategoryState: payload.CategoryState, CategoriesChanged: payload.CategoriesChanged, OccurredAt: e.OccurredAt,
	}
	if payload.Cause != nil {
		event.Cause = app.Cause{Method: payload.Cause.Method, RuleID: payload.Cause.RuleID}
	}
	return app.NewService(postgres.NewTxRepository(tx), p).HandleEvent(ctx, event)
}

// Tools returns the classification module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc, m.names, m.ledger.Today), Errors: tool.FromProblem(httpapi.ToProblem)}
}

func (m *Module) names(ctx context.Context, userID int64) (categories, payees map[uuid.UUID]string, err error) {
	accounts, ps, err := m.ledger.CaptureVocabulary(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	categories, payees = make(map[uuid.UUID]string, len(accounts)), make(map[uuid.UUID]string, len(ps))
	for _, a := range accounts {
		categories[a.ID] = a.Name
	}
	for _, p := range ps {
		payees[p.ID] = p.Name
	}
	return categories, payees, nil
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// ImportLine is a statement line before the ledger records it.
type ImportLine = app.ImportLine

// LineCategory is the aggregator category of an imported line (P6 amendment A41).
type LineCategory = app.LineCategory

// DecideImport decides payee, tags and category of each line before the ledger records it
// (P5 amendment A19); the decision of a line with nothing to set is nil.
func (m *Module) DecideImport(ctx context.Context, userID int64, lines []ImportLine) ([]*ledger.ImportDecision, error) {
	decisions, err := m.svc.DecideImport(ctx, userID, lines)
	if err != nil {
		return nil, err
	}
	out := make([]*ledger.ImportDecision, len(decisions))
	for i, d := range decisions {
		if d != nil {
			out[i] = importDecision(*d)
		}
	}
	return out, nil
}

// importDecisions keeps nil for a decision without payee, tags or category.
func importDecisions(ds []domain.Decision) []*ledger.ImportDecision {
	out := make([]*ledger.ImportDecision, len(ds))
	for i, d := range ds {
		if d.Method != "" || d.PayeeID != uuid.Nil || len(d.AddTags) > 0 {
			out[i] = importDecision(d)
		}
	}
	return out
}

func importDecision(d domain.Decision) *ledger.ImportDecision {
	out := &ledger.ImportDecision{
		PayeeID: d.PayeeID, AddTags: d.AddTags, TransferTo: d.TransferTo, Cause: ledger.Cause{Method: d.Method, RuleID: d.RuleID},
	}
	for _, a := range d.Parts {
		out.Parts = append(out.Parts, ledger.CategoryPart{AccountID: a.CategoryID, Amount: a.Amount})
	}
	return out
}

// ManualLine is a line the owner writes, before the ledger records it. NamedPayee is the
// payee whose name equals the description, the line's payee when no alias resolves one.
type ManualLine struct {
	AccountID   uuid.UUID
	Date        time.Time
	Amount      money.Money
	Description string
	NamedPayee  uuid.UUID
}

// DecideManual decides payee, tags and category of each line with the precedence of F5 for
// origin manual (capture A113); the decision of a line with nothing to set is nil.
func (m *Module) DecideManual(ctx context.Context, userID int64, lines []ManualLine) ([]*ledger.ImportDecision, error) {
	in := make([]app.ManualLine, len(lines))
	for i, l := range lines {
		in[i] = app.ManualLine{
			ImportLine: app.ImportLine{AccountID: l.AccountID, Date: l.Date, Amount: l.Amount, Description: l.Description},
			NamedPayee: l.NamedPayee,
		}
	}
	decisions, err := m.svc.DecideManual(ctx, userID, in)
	if err != nil {
		return nil, err
	}
	return importDecisions(decisions), nil
}

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) AccountFacts(ctx context.Context, userID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, userID)
	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{
			ID: a.ID, Class: a.Class, Kind: a.Kind, SystemRole: a.SystemRole,
			Instrument: a.Instrument, OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn,
		}
	}
	return out, err
}

func (p ledgerPort) TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]app.TransactionFacts, error) {
	facts, err := p.l.TransactionFacts(ctx, userID, ids)
	out := make([]app.TransactionFacts, len(facts))
	for i, f := range facts {
		out[i] = app.TransactionFacts{
			ID: f.ID, Version: f.Version, Date: f.Date, Description: f.Description, RawDescription: f.RawDescription,
			PayeeID: f.PayeeID, Origin: f.Origin, Voided: f.Voided, CategoryState: f.CategoryState,
			Postings: make([]app.FactPosting, len(f.Postings)),
		}
		for j, x := range f.Postings {
			out[i].Postings[j] = app.FactPosting{AccountID: x.AccountID, Class: x.Class, Kind: x.Kind, SystemRole: x.SystemRole, Amount: x.Amount, Installment: x.Installment}
		}
	}
	return out, err
}

func (p ledgerPort) LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[domain.HistoryKey]uuid.UUID, error) {
	latest, err := p.l.LatestPayeeCategories(ctx, userID, payees)
	out := make(map[domain.HistoryKey]uuid.UUID, len(latest))
	for k, v := range latest {
		out[domain.HistoryKey{PayeeID: k.PayeeID, Class: k.Class}] = v
	}
	return out, err
}

func (p ledgerPort) Categorize(ctx context.Context, userID int64, cs []app.Categorization) ([]error, error) {
	items := make([]ledger.Categorization, len(cs))
	for i, c := range cs {
		items[i] = ledger.Categorization{
			TransactionID: c.TransactionID, ExpectedVersion: c.ExpectedVersion, PayeeID: c.PayeeID, AddTags: c.AddTags,
			Cause: ledger.Cause{Method: c.Method, RuleID: c.RuleID},
		}
		if c.Parts != nil {
			items[i].Parts = make([]ledger.CategoryPart, len(c.Parts))
			for j, a := range c.Parts {
				items[i].Parts[j] = ledger.CategoryPart{AccountID: a.CategoryID, Amount: a.Amount}
			}
		}
	}
	return p.l.Categorize(ctx, userID, items)
}

func (p ledgerPort) Transfer(ctx context.Context, userID int64, t app.TransferRequest) (bool, error) {
	_, err := p.l.Transfer(ctx, userID, ledger.TransferRequest{
		TransactionID: t.TransactionID, ExpectedVersion: t.ExpectedVersion, AccountID: t.AccountID,
		Cause: ledger.Cause{Method: app.MethodRule, RuleID: t.RuleID},
	})
	for _, refused := range []error{
		ledger.ErrNotFound, ledger.ErrValidation, ledger.ErrVersionConflict, ledger.ErrVoided,
		ledger.ErrReconciled, ledger.ErrNotCategorizable, ledger.ErrPairingAmbiguous,
	} {
		if errors.Is(err, refused) {
			return false, nil
		}
	}
	return err == nil, err
}

func (p ledgerPort) Today() time.Time { return p.l.Today() }

func (p ledgerPort) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	return p.l.MissingPayees(ctx, userID, ids)
}
