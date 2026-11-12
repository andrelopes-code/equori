package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func previewImportsAction(
	ctx context.Context,
	svc *app.Service,
	names AccountNames,
	booksID int64,
	in manageImportsIn,
) (tool.Preview, error) {
	a, err := parseImportsAction(in)
	if err != nil {
		return tool.Preview{}, err
	}

	p := tool.Preview{Action: "manage_imports." + string(in.Action)}
	switch in.Action {
	case "sync", "delete_connection":
		return previewConnection(ctx, svc, booksID, a, in, p)
	case "map_account":
		return previewMapping(ctx, svc, names, booksID, a, in, p)
	case "resolve_record":
		return previewResolve(ctx, svc, booksID, a, in, p)
	case "reopen_record":
		return previewReopen(ctx, svc, booksID, a, p)
	case "undo_decision":
		return previewUndo(ctx, svc, booksID, a, p)
	case "delete_integration":
		return previewDeleteIntegration(ctx, svc, booksID, a, p)
	}

	return p, nil
}

func previewConnection(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a importsAction,
	in manageImportsIn,
	p tool.Preview,
) (tool.Preview, error) {
	c, err := svc.Connection(ctx, booksID, a.connection)
	if err != nil {
		return tool.Preview{}, err
	}

	p.Target = "Connection " + c.Name
	if in.Action == "sync" {
		p.Changes = []tool.Change{{Field: "connection", After: tool.TextValue(c.Name)}}
	} else {
		p.Changes, p.Destructive = []tool.Change{
			{Field: "connection", Before: tool.TextValue(c.Name)},
		}, true
	}

	return p, nil
}

func previewResolve(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a importsAction,
	in manageImportsIn,
	p tool.Preview,
) (tool.Preview, error) {
	rec, err := svc.Record(ctx, booksID, a.record)
	if err != nil {
		return tool.Preview{}, err
	}

	if rec.State != domain.StateNeedsReview {
		return tool.Preview{}, app.ErrRecordResolved
	}

	p.Target = "Bank line " + rec.Description + " of " + rec.Date.Format(time.DateOnly)

	p.Changes = []tool.Change{
		{
			Field:  "status",
			Before: tool.TextValue(string(rec.State)),
			After:  tool.TextValue(string(resolvedState[in.Resolution])),
		},
	}
	if in.Resolution == app.ActionMatch {
		if !slices.Contains(rec.Candidates, a.transaction) {
			return tool.Preview{}, &domain.FieldError{
				Field:   "transaction_id",
				Message: "must be one of the record's candidates",
			}
		}

		p.Changes = append(
			p.Changes,
			tool.Change{Field: "transaction", After: tool.TextValue(in.TransactionID)},
		)
	}

	return p, nil
}

func previewReopen(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a importsAction,
	p tool.Preview,
) (tool.Preview, error) {
	rec, err := svc.Record(ctx, booksID, a.record)
	if err != nil {
		return tool.Preview{}, err
	}

	if rec.State != domain.StateDiscarded {
		return tool.Preview{}, app.ErrRecordNotDiscarded
	}

	p.Target = "Bank line " + rec.Description + " of " + rec.Date.Format(time.DateOnly)
	p.Changes = []tool.Change{
		{
			Field:  "status",
			Before: tool.TextValue(string(rec.State)),
			After:  tool.TextValue(string(domain.StateNeedsReview)),
		},
	}

	return p, nil
}

func previewUndo(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a importsAction,
	p tool.Preview,
) (tool.Preview, error) {
	rec, err := svc.Record(ctx, booksID, a.record)
	if err != nil {
		return tool.Preview{}, err
	}

	if rec.Decision == "" {
		return tool.Preview{}, app.ErrNoDecision
	}

	p.Target = "Bank line " + rec.Description + " of " + rec.Date.Format(time.DateOnly)
	p.Changes = []tool.Change{{Field: "decision", Before: tool.TextValue(string(rec.Decision))}}

	return p, nil
}

func previewDeleteIntegration(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a importsAction,
	p tool.Preview,
) (tool.Preview, error) {
	i, err := svc.Integration(ctx, booksID, a.integration)
	if err != nil {
		return tool.Preview{}, err
	}

	if inUse, err := integrationInUse(ctx, svc, booksID, a.integration); err != nil {
		return tool.Preview{}, err
	} else if inUse {
		return tool.Preview{}, app.ErrIntegrationInUse
	}

	p.Target, p.Destructive = "Integration "+i.Name, true
	p.Changes = []tool.Change{{Field: "name", Before: tool.TextValue(i.Name)}}

	return p, nil
}

func previewMapping(
	ctx context.Context,
	svc *app.Service,
	names AccountNames,
	booksID int64,
	a importsAction,
	in manageImportsIn,
	p tool.Preview,
) (tool.Preview, error) {
	m := a.mapping(in)
	if err := m.Validate(); err != nil {
		return tool.Preview{}, err
	}

	c, err := svc.Connection(ctx, booksID, a.connection)
	if err != nil {
		return tool.Preview{}, err
	}

	ext, err := connectionAccount(c, a.external)
	if err != nil {
		return tool.Preview{}, err
	}

	p.Target = "Bank account " + ext.Name + " of connection " + c.Name
	if in.Ignore {
		p.Changes = []tool.Change{
			{
				Field:  "status",
				Before: tool.TextValue(string(ext.State())),
				After:  tool.TextValue(string(domain.MappingIgnored)),
			},
		}

		return p, nil
	}

	named, err := names(ctx, booksID)
	if err != nil {
		return tool.Preview{}, err
	}

	to, ok := named[a.account]
	if !ok {
		return tool.Preview{}, &domain.FieldError{
			Field:   "account_id",
			Message: "must be a balance account of the book",
		}
	}

	p.Changes = accountChanges(ext, named, to, m.SyncFrom)

	return p, nil
}

func connectionAccount(c domain.Connection, id uuid.UUID) (domain.ExternalAccount, error) {
	i := slices.IndexFunc(
		c.Accounts,
		func(e domain.ExternalAccount) bool { return e.ID == id },
	)
	if i < 0 {
		return domain.ExternalAccount{}, app.ErrNotFound
	}

	return c.Accounts[i], nil
}

func accountChanges(
	ext domain.ExternalAccount,
	named map[uuid.UUID]string,
	to string,
	syncFrom *time.Time,
) []tool.Change {
	change := tool.Change{Field: "account", After: tool.TextValue(to)}
	if ext.AccountID != nil {
		change.Before = tool.TextValue(named[*ext.AccountID])
	}

	changes := []tool.Change{change}
	if syncFrom != nil {
		change := tool.Change{Field: "date", After: tool.DateValue(*syncFrom)}
		if ext.SyncFrom != nil {
			change.Before = tool.DateValue(*ext.SyncFrom)
		}

		changes = append(changes, change)
	}

	return changes
}

func integrationInUse(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
) (bool, error) {
	r := page.Request[app.NameKey]{Limit: page.MaxLimit}
	for {
		cs, next, err := svc.ListConnections(ctx, booksID, r)
		if err != nil {
			return false, err
		}

		if slices.ContainsFunc(
			cs,
			func(c domain.Connection) bool { return c.IntegrationID == id },
		) {
			return true, nil
		}

		if next == nil {
			return false, nil
		}

		r.After = next
	}
}
