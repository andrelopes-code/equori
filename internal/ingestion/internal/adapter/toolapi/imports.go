package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type importsView string

func (importsView) Values() []string {
	return []string{"batches", "records", "unconfirmed", "connections", "syncs"}
}

type recordState string

func (recordState) Values() []string {
	return []string{"received", "matched", "created", "needs_review", "discarded", "withdrawn"}
}

type getImportsIn struct {
	View         importsView `json:"view" jsonschema:"what to return"`
	BatchID      string      `json:"batch_id,omitzero" jsonschema:"for records: batch from the batches view"`
	State        recordState `json:"state,omitzero" jsonschema:"for records: keep records in this state"`
	AccountID    string      `json:"account_id,omitzero" jsonschema:"for unconfirmed: balance account from list_accounts"`
	ConnectionID string      `json:"connection_id,omitzero" jsonschema:"for syncs: connection from the connections view"`
	tool.PageArgs
}

type countsView struct {
	Received     int `json:"received,omitzero"`
	Ignored      int `json:"ignored,omitzero"`
	Matched      int `json:"matched,omitzero"`
	Created      int `json:"created,omitzero"`
	NeedsReview  int `json:"needs_review,omitzero"`
	Discarded    int `json:"discarded,omitzero"`
	Updated      int `json:"updated,omitzero"`
	Withdrawn    int `json:"withdrawn,omitzero"`
	ReIdentified int `json:"re_identified,omitzero"`
}

type batchView struct {
	BatchID     string     `json:"batch_id"`
	AccountName string     `json:"account_name,omitzero"`
	Source      string     `json:"source" jsonschema:"file format, or the aggregator for a sync"`
	FileName    string     `json:"file_name,omitzero"`
	StartedAt   string     `json:"started_at" jsonschema:"RFC 3339 time"`
	Counts      countsView `json:"counts" jsonschema:"lines by outcome; absent outcomes are zero"`
}

type recordView struct {
	RecordID     string     `json:"record_id"`
	Date         tool.Date  `json:"date"`
	Description  string     `json:"description"`
	Amount       tool.Money `json:"amount"`
	State        string     `json:"state"`
	ReviewReason string     `json:"review_reason,omitzero"`
	Candidates   []string   `json:"candidates,omitzero" jsonschema:"transactions the record may match, best first; get_transaction describes them"`
	Decision     string     `json:"decision,omitzero" jsonschema:"linked, followed, withdrawn or re_identified: the automatic decision undo_decision of manage_imports reverts"`
}

type syncView struct {
	SyncID    string       `json:"sync_id"`
	StartedAt string       `json:"started_at" jsonschema:"RFC 3339 time"`
	Batches   []batchView  `json:"batches"`
	Records   []recordView `json:"records,omitzero" jsonschema:"lines of the run with an automatic decision"`
}

type unconfirmedView struct {
	TransactionID string     `json:"transaction_id"`
	Date          tool.Date  `json:"date"`
	Description   string     `json:"description"`
	Amount        tool.Money `json:"amount"`
}

type externalAccountView struct {
	ExternalAccountID string `json:"external_account_id"`
	Name              string `json:"name"`
	State             string `json:"state" jsonschema:"mapped, ignored or pending a decision"`
	AccountName       string `json:"account_name,omitzero" jsonschema:"ledger account receiving the lines"`
}

type connectionView struct {
	ConnectionID string                `json:"connection_id"`
	Name         string                `json:"name"`
	State        string                `json:"state" jsonschema:"ok, needs_owner, failed, stalled (no institution data for more than 72 hours) or consent_expiring (consent expires within 14 days)"`
	LastSyncedAt string                `json:"last_synced_at,omitzero" jsonschema:"RFC 3339 time"`
	LastError    string                `json:"last_error,omitzero"`
	Accounts     []externalAccountView `json:"accounts"`
}

type integrationView struct {
	IntegrationID string `json:"integration_id"`
	Name          string `json:"name"`
	Aggregator    string `json:"aggregator"`
}

type getImportsOut struct {
	Batches      []batchView       `json:"batches,omitzero"`
	BatchID      string            `json:"batch_id,omitzero"`
	AccountID    string            `json:"account_id,omitzero"`
	AccountName  string            `json:"account_name,omitzero"`
	Records      []recordView      `json:"records,omitzero"`
	Unconfirmed  []unconfirmedView `json:"unconfirmed,omitzero"`
	Connections  []connectionView  `json:"connections,omitzero"`
	Syncs        []syncView        `json:"syncs,omitzero"`
	Integrations []integrationView `json:"integrations,omitzero"`
	NextCursor   string            `json:"next_cursor,omitzero" jsonschema:"present when more items follow; pass it as cursor"`
}

func getImports(svc *app.Service, names AccountNames) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_imports",
		Description: "Returns import activity: statement import batches with their counts, the records of a batch and those needing review, " +
			"entries of an account that no bank line confirmed, bank connections with their sync state and accounts, and the recent syncs of a connection with the automatic decisions they made. " +
			"Use it for whether a bank synced, what an import did or what needs review. " +
			"Do not use it for the transactions themselves: search_transactions does.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getImportsIn) (getImportsOut, error) {
		fields := []field{{"batch_id", in.BatchID != ""}, {"state", in.State != ""}, {"account_id", in.AccountID != ""}, {"connection_id", in.ConnectionID != ""}}

		named, err := names(ctx, booksID)
		if err != nil {
			return getImportsOut{}, err
		}

		switch in.View {
		case "records":
			// state is optional for records.
			if err := required("records", []field{fields[0], fields[2], fields[3]}, "batch_id"); err != nil {
				return getImportsOut{}, err
			}

			return records(ctx, svc, booksID, in, named)
		case "unconfirmed":
			if err := required("unconfirmed", fields, "account_id"); err != nil {
				return getImportsOut{}, err
			}

			return unconfirmed(ctx, svc, booksID, in, named)
		case "syncs":
			if err := required("syncs", fields, "connection_id"); err != nil {
				return getImportsOut{}, err
			}

			return syncs(ctx, svc, booksID, in, named)
		case "connections":
			if err := required("connections", fields); err != nil {
				return getImportsOut{}, err
			}

			return connections(ctx, svc, booksID, in, named)
		}

		if err := required("batches", fields); err != nil {
			return getImportsOut{}, err
		}

		p, err := pageRequest[app.BatchKey](in.PageArgs)
		if err != nil {
			return getImportsOut{}, err
		}

		batches, next, err := svc.ListBatches(ctx, booksID, p)
		if err != nil {
			return getImportsOut{}, err
		}

		out := getImportsOut{Batches: []batchView{}}
		for _, b := range batches {
			out.Batches = append(out.Batches, toBatchView(b, named))
		}

		out.NextCursor, err = nextCursor(next)

		return out, err
	})
}

func toBatchView(b domain.Batch, named map[uuid.UUID]string) batchView {
	c := b.Counts

	return batchView{
		BatchID: b.ID.String(), AccountName: named[b.AccountID], Source: string(b.Source), FileName: b.FileName,
		StartedAt: b.StartedAt.UTC().Format(time.RFC3339),
		Counts: countsView{
			Received: c.Received, Ignored: c.Ignored, Matched: c.Matched, Created: c.Created,
			NeedsReview: c.NeedsReview, Discarded: c.Discarded, Updated: c.Updated, Withdrawn: c.Withdrawn, ReIdentified: c.ReIdentified,
		},
	}
}

func records(ctx context.Context, svc *app.Service, booksID int64, in getImportsIn, named map[uuid.UUID]string) (getImportsOut, error) {
	id, err := optionalID(in.BatchID, "batch_id")
	if err != nil {
		return getImportsOut{}, err
	}

	p, err := pageRequest[app.RecordKey](in.PageArgs)
	if err != nil {
		return getImportsOut{}, err
	}

	recs, next, b, err := svc.Records(ctx, booksID, id, domain.RecordState(in.State), p)
	if err != nil {
		return getImportsOut{}, err
	}

	out := getImportsOut{BatchID: b.ID.String(), AccountName: named[b.AccountID], Records: []recordView{}}
	for _, r := range recs {
		v, err := toRecordView(r, b.Currency)
		if err != nil {
			return getImportsOut{}, err
		}

		out.Records = append(out.Records, v)
	}

	out.NextCursor, err = nextCursor(next)

	return out, err
}

func toRecordView(r domain.ExternalRecord, currency string) (recordView, error) {
	amount, err := moneyOf(r.Amount, currency)
	if err != nil {
		return recordView{}, err
	}

	v := recordView{
		RecordID: r.ID.String(), Date: tool.DateOf(r.Date), Description: r.Description, Amount: amount,
		State: string(r.State), ReviewReason: r.ReviewReason, Decision: string(r.Decision),
	}
	for _, c := range r.Candidates {
		v.Candidates = append(v.Candidates, c.String())
	}

	return v, nil
}

func syncs(ctx context.Context, svc *app.Service, booksID int64, in getImportsIn, named map[uuid.UUID]string) (getImportsOut, error) {
	id, err := optionalID(in.ConnectionID, "connection_id")
	if err != nil {
		return getImportsOut{}, err
	}

	runs, err := svc.SyncRuns(ctx, booksID, id)
	if err != nil {
		return getImportsOut{}, err
	}

	out := getImportsOut{Syncs: []syncView{}}
	for _, run := range runs {
		currency := make(map[uuid.UUID]string, len(run.Batches))
		v := syncView{SyncID: run.ID.String(), StartedAt: run.StartedAt.UTC().Format(time.RFC3339), Batches: []batchView{}}

		for _, b := range run.Batches {
			v.Batches = append(v.Batches, toBatchView(b, named))
			currency[b.ID] = b.Currency
		}

		for _, r := range run.Records {
			if r.Decision == "" {
				continue
			}

			rv, err := toRecordView(r, currency[r.SummaryBatchID])
			if err != nil {
				return getImportsOut{}, err
			}

			v.Records = append(v.Records, rv)
		}

		out.Syncs = append(out.Syncs, v)
	}

	return out, nil
}

func unconfirmed(ctx context.Context, svc *app.Service, booksID int64, in getImportsIn, named map[uuid.UUID]string) (getImportsOut, error) {
	id, err := optionalID(in.AccountID, "account_id")
	if err != nil {
		return getImportsOut{}, err
	}

	ps, currency, err := svc.Unconfirmed(ctx, booksID, id)
	if err != nil {
		return getImportsOut{}, err
	}

	views := []unconfirmedView{}
	for _, p := range ps {
		amount, err := moneyOf(p.Amount, string(currency))
		if err != nil {
			return getImportsOut{}, err
		}

		views = append(views, unconfirmedView{TransactionID: p.TransactionID.String(), Date: tool.DateOf(p.Date), Description: p.Description, Amount: amount})
	}

	out := getImportsOut{AccountID: in.AccountID, AccountName: named[id]}
	out.Unconfirmed, out.NextCursor, err = tool.PageOf(views, func(v unconfirmedView) string { return v.TransactionID }, in.PageArgs)

	return out, err
}

func connections(ctx context.Context, svc *app.Service, booksID int64, in getImportsIn, named map[uuid.UUID]string) (getImportsOut, error) {
	p, err := pageRequest[app.NameKey](in.PageArgs)
	if err != nil {
		return getImportsOut{}, err
	}

	cs, next, err := svc.ListConnections(ctx, booksID, p)
	if err != nil {
		return getImportsOut{}, err
	}

	out := getImportsOut{Connections: []connectionView{}, Integrations: []integrationView{}}
	for _, c := range cs {
		v := connectionView{ConnectionID: c.ID.String(), Name: c.Name, State: string(c.State), LastError: c.LastError, Accounts: []externalAccountView{}}
		if c.LastSyncedAt != nil {
			v.LastSyncedAt = c.LastSyncedAt.UTC().Format(time.RFC3339)
		}

		for _, a := range c.Accounts {
			ev := externalAccountView{ExternalAccountID: a.ID.String(), Name: a.Name, State: string(a.State())}
			if a.AccountID != nil {
				ev.AccountName = named[*a.AccountID]
			}

			v.Accounts = append(v.Accounts, ev)
		}

		out.Connections = append(out.Connections, v)
	}

	if out.NextCursor, err = nextCursor(next); err != nil {
		return getImportsOut{}, err
	}

	aggregators := map[string]string{}
	for _, a := range svc.Aggregators() {
		aggregators[a.ID()] = a.Name()
	}

	// shortcut: integrations are listed up to one page of tool.MaxLimit; a household has a handful.
	is, _, err := svc.ListIntegrations(ctx, booksID, page.Request[app.NameKey]{Limit: tool.MaxLimit})
	if err != nil {
		return getImportsOut{}, err
	}

	for _, i := range is {
		name := aggregators[string(i.Aggregator)]
		if name == "" {
			name = string(i.Aggregator)
		}

		out.Integrations = append(out.Integrations, integrationView{IntegrationID: i.ID.String(), Name: i.Name, Aggregator: name})
	}

	return out, nil
}
