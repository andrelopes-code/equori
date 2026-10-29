package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageImportsAction string

func (manageImportsAction) Values() []string {
	return []string{"sync", "map_account", "resolve_record", "reopen_record", "delete_connection", "delete_integration"}
}

type resolution string

func (resolution) Values() []string {
	return []string{app.ActionMatch, app.ActionCreate, app.ActionDiscard}
}

type manageImportsIn struct {
	Action            manageImportsAction `json:"action" jsonschema:"operation to propose"`
	ConnectionID      string              `json:"connection_id,omitzero" jsonschema:"for sync, map_account and delete_connection: connection from get_imports"`
	ExternalAccountID string              `json:"external_account_id,omitzero" jsonschema:"for map_account: bank account of the connection, from get_imports"`
	AccountID         string              `json:"account_id,omitzero" jsonschema:"for map_account: ledger account receiving the bank account's lines; absent with ignore"`
	Ignore            bool                `json:"ignore,omitzero" jsonschema:"for map_account: stop importing this bank account"`
	SyncFrom          tool.Date           `json:"sync_from,omitzero" jsonschema:"for map_account: first date imported"`
	RecordID          string              `json:"record_id,omitzero" jsonschema:"for resolve_record and reopen_record: record from get_imports"`
	Resolution        resolution          `json:"resolution,omitzero" jsonschema:"for resolve_record: match links it to transaction_id, create records a new transaction, discard drops it"`
	TransactionID     string              `json:"transaction_id,omitzero" jsonschema:"for resolve_record with match: transaction from search_transactions"`
	IntegrationID     string              `json:"integration_id,omitzero" jsonschema:"for delete_integration: integration from get_imports"`
}

type manageImportsOut struct {
	ConnectionID      string      `json:"connection_id,omitzero"`
	State             string      `json:"state,omitzero"`
	Batches           []batchView `json:"batches,omitzero"`
	ExternalAccountID string      `json:"external_account_id,omitzero"`
	AccountName       string      `json:"account_name,omitzero"`
	RecordID          string      `json:"record_id,omitzero"`
	TransactionID     string      `json:"transaction_id,omitzero"`
	Deleted           bool        `json:"deleted,omitzero"`
}

// resolvedState is the state a resolution leaves the record in.
var resolvedState = map[resolution]domain.RecordState{
	app.ActionMatch: domain.StateMatched, app.ActionCreate: domain.StateCreated, app.ActionDiscard: domain.StateDiscarded,
}

// importsAction holds the parsed identifiers of a manage_imports call.
type importsAction struct {
	connection, external, account, record, transaction, integration uuid.UUID
}

func parseImportsAction(in manageImportsIn) (importsAction, error) {
	fields := []field{
		{"connection_id", in.ConnectionID != ""}, {"external_account_id", in.ExternalAccountID != ""},
		{"account_id", in.AccountID != ""}, {"ignore", in.Ignore}, {"sync_from", !in.SyncFrom.IsZero()},
		{"record_id", in.RecordID != ""}, {"resolution", in.Resolution != ""}, {"transaction_id", in.TransactionID != ""},
		{"integration_id", in.IntegrationID != ""},
	}
	name := string(in.Action)
	var err error
	switch in.Action {
	case "sync", "delete_connection":
		err = required(name, fields, "connection_id")
	case "map_account":
		// account_id, ignore and sync_from combine as domain.Mapping.Validate checks.
		err = required(name, slices.DeleteFunc(slices.Clone(fields), func(f field) bool {
			return f.name == "account_id" || f.name == "ignore" || f.name == "sync_from"
		}), "connection_id", "external_account_id")
	case "resolve_record":
		if in.Resolution == app.ActionMatch {
			err = required(name+" with match", fields, "record_id", "resolution", "transaction_id")
		} else {
			err = required(name+" with "+string(in.Resolution), fields, "record_id", "resolution")
		}
	case "reopen_record":
		err = required(name, fields, "record_id")
	case "delete_integration":
		err = required(name, fields, "integration_id")
	}
	if err != nil {
		return importsAction{}, err
	}
	var a importsAction
	for _, id := range []struct {
		s, field string
		into     *uuid.UUID
	}{
		{in.ConnectionID, "connection_id", &a.connection}, {in.ExternalAccountID, "external_account_id", &a.external},
		{in.AccountID, "account_id", &a.account}, {in.RecordID, "record_id", &a.record},
		{in.TransactionID, "transaction_id", &a.transaction}, {in.IntegrationID, "integration_id", &a.integration},
	} {
		if *id.into, err = optionalID(id.s, id.field); err != nil {
			return importsAction{}, err
		}
	}
	return a, nil
}

func (a importsAction) mapping(in manageImportsIn) domain.Mapping {
	m := domain.Mapping{Ignored: in.Ignore}
	if a.account != uuid.Nil {
		m.AccountID = &a.account
	}
	if !in.SyncFrom.IsZero() {
		m.SyncFrom = &in.SyncFrom.Time
	}
	return m
}

func manageImports(svc *app.Service, names AccountNames) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_imports",
		Description: "Proposes an action on imports and bank connections: sync a connection now, map a bank account of a connection " +
			"to a ledger account or ignore it, resolve a record that needs review, reopen a discarded record, delete a connection, or delete an integration without connections. " +
			"Use it when the user asks to sync, map, review or remove a bank link. " +
			"Do not use it to add credentials or a new connection: the user does that on the Links screen, and get_help explains it. " +
			"The user confirms first.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, userID int64, in manageImportsIn) (tool.Preview, error) {
		a, err := parseImportsAction(in)
		if err != nil {
			return tool.Preview{}, err
		}
		p := tool.Preview{Action: "manage_imports." + string(in.Action)}
		switch in.Action {
		case "sync", "delete_connection":
			c, err := svc.Connection(ctx, userID, a.connection)
			if err != nil {
				return tool.Preview{}, err
			}
			p.Target = "Connection " + c.Name
			if in.Action == "sync" {
				p.Changes = []tool.Change{{Field: "connection", After: tool.TextValue(c.Name)}}
			} else {
				p.Changes, p.Destructive = []tool.Change{{Field: "connection", Before: tool.TextValue(c.Name)}}, true
			}
		case "map_account":
			return previewMapping(ctx, svc, names, userID, a, in, p)
		case "resolve_record":
			rec, err := svc.Record(ctx, userID, a.record)
			if err != nil {
				return tool.Preview{}, err
			}
			if rec.State != domain.StateNeedsReview {
				return tool.Preview{}, app.ErrRecordResolved
			}
			p.Target = "Bank line " + rec.Description + " of " + rec.Date.Format(time.DateOnly)
			p.Changes = []tool.Change{{Field: "status", Before: tool.TextValue(string(rec.State)), After: tool.TextValue(string(resolvedState[in.Resolution]))}}
			if in.Resolution == app.ActionMatch {
				if !slices.Contains(rec.Candidates, a.transaction) {
					return tool.Preview{}, &domain.FieldError{Field: "transaction_id", Message: "must be one of the record's candidates"}
				}
				p.Changes = append(p.Changes, tool.Change{Field: "transaction", After: tool.TextValue(in.TransactionID)})
			}
		case "reopen_record":
			rec, err := svc.Record(ctx, userID, a.record)
			if err != nil {
				return tool.Preview{}, err
			}
			if rec.State != domain.StateDiscarded {
				return tool.Preview{}, app.ErrRecordNotDiscarded
			}
			p.Target = "Bank line " + rec.Description + " of " + rec.Date.Format(time.DateOnly)
			p.Changes = []tool.Change{{Field: "status", Before: tool.TextValue(string(rec.State)), After: tool.TextValue(string(domain.StateNeedsReview))}}
		case "delete_integration":
			i, err := svc.Integration(ctx, userID, a.integration)
			if err != nil {
				return tool.Preview{}, err
			}
			if inUse, err := integrationInUse(ctx, svc, userID, a.integration); err != nil {
				return tool.Preview{}, err
			} else if inUse {
				return tool.Preview{}, app.ErrIntegrationInUse
			}
			p.Target, p.Destructive = "Integration "+i.Name, true
			p.Changes = []tool.Change{{Field: "name", Before: tool.TextValue(i.Name)}}
		}
		return p, nil
	}, func(ctx context.Context, userID int64, in manageImportsIn) (manageImportsOut, error) {
		a, err := parseImportsAction(in)
		if err != nil {
			return manageImportsOut{}, err
		}
		switch in.Action {
		case "sync":
			c, batches, err := svc.SyncConnection(ctx, userID, a.connection)
			if err != nil {
				return manageImportsOut{}, err
			}
			named, err := names(ctx, userID)
			if err != nil {
				return manageImportsOut{}, err
			}
			out := manageImportsOut{ConnectionID: c.ID.String(), State: string(c.State), Batches: []batchView{}}
			for _, b := range batches {
				out.Batches = append(out.Batches, toBatchView(b, named))
			}
			return out, nil
		case "map_account":
			ext, err := svc.MapAccount(ctx, userID, a.connection, a.external, a.mapping(in))
			if err != nil {
				return manageImportsOut{}, err
			}
			out := manageImportsOut{ExternalAccountID: ext.ID.String(), State: string(ext.State())}
			if ext.AccountID != nil {
				named, err := names(ctx, userID)
				if err != nil {
					return manageImportsOut{}, err
				}
				out.AccountName = named[*ext.AccountID]
			}
			return out, nil
		case "resolve_record":
			rec, _, err := svc.Resolve(ctx, userID, a.record, string(in.Resolution), a.transaction)
			if err != nil {
				return manageImportsOut{}, err
			}
			out := manageImportsOut{RecordID: rec.ID.String(), State: string(rec.State)}
			if rec.TransactionID != uuid.Nil {
				out.TransactionID = rec.TransactionID.String()
			}
			return out, nil
		case "reopen_record":
			rec, _, err := svc.Reopen(ctx, userID, a.record)
			if err != nil {
				return manageImportsOut{}, err
			}
			return manageImportsOut{RecordID: rec.ID.String(), State: string(rec.State)}, nil
		case "delete_connection":
			return manageImportsOut{Deleted: true}, svc.DeleteConnection(ctx, userID, a.connection)
		}
		return manageImportsOut{Deleted: true}, svc.DeleteIntegration(ctx, userID, a.integration)
	})
}

func previewMapping(ctx context.Context, svc *app.Service, names AccountNames, userID int64, a importsAction, in manageImportsIn, p tool.Preview) (tool.Preview, error) {
	m := a.mapping(in)
	if err := m.Validate(); err != nil {
		return tool.Preview{}, err
	}
	c, err := svc.Connection(ctx, userID, a.connection)
	if err != nil {
		return tool.Preview{}, err
	}
	i := slices.IndexFunc(c.Accounts, func(e domain.ExternalAccount) bool { return e.ID == a.external })
	if i < 0 {
		return tool.Preview{}, app.ErrNotFound
	}
	ext := c.Accounts[i]
	p.Target = "Bank account " + ext.Name + " of connection " + c.Name
	if in.Ignore {
		p.Changes = []tool.Change{{Field: "status", Before: tool.TextValue(string(ext.State())), After: tool.TextValue(string(domain.MappingIgnored))}}
		return p, nil
	}
	named, err := names(ctx, userID)
	if err != nil {
		return tool.Preview{}, err
	}
	to, ok := named[a.account]
	if !ok {
		return tool.Preview{}, &domain.FieldError{Field: "account_id", Message: "must be a balance account of the user"}
	}
	change := tool.Change{Field: "account", After: tool.TextValue(to)}
	if ext.AccountID != nil {
		change.Before = tool.TextValue(named[*ext.AccountID])
	}
	p.Changes = []tool.Change{change}
	if m.SyncFrom != nil {
		change := tool.Change{Field: "date", After: tool.DateValue(*m.SyncFrom)}
		if ext.SyncFrom != nil {
			change.Before = tool.DateValue(*ext.SyncFrom)
		}
		p.Changes = append(p.Changes, change)
	}
	return p, nil
}

func integrationInUse(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (bool, error) {
	r := page.Request[app.NameKey]{Limit: page.MaxLimit}
	for {
		cs, next, err := svc.ListConnections(ctx, userID, r)
		if err != nil {
			return false, err
		}
		if slices.ContainsFunc(cs, func(c domain.Connection) bool { return c.IntegrationID == id }) {
			return true, nil
		}
		if next == nil {
			return false, nil
		}
		r.After = next
	}
}
