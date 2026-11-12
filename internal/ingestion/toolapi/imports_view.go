package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func toBatchView(b domain.Batch, named map[uuid.UUID]string) batchView {
	c := b.Counts

	return batchView{
		BatchID: b.ID.String(), AccountName: named[b.AccountID], Source: string(b.Source), FileName: b.FileName,
		StartedAt: b.StartedAt.UTC().Format(time.RFC3339),
		Counts: countsView{
			Received: c.Received, Ignored: c.Ignored, Matched: c.Matched, Created: c.Created,
			NeedsReview: c.NeedsReview, Discarded: c.Discarded, Updated: c.Updated, Withdrawn: c.Withdrawn, ReIdentified: c.ReIdentified, Paired: c.Paired,
		},
	}
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

func toConnectionView(c domain.Connection, named map[uuid.UUID]string) connectionView {
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

	return v
}

func integrationViews(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	out []integrationView,
) ([]integrationView, error) {
	aggregators := map[string]string{}
	for _, a := range svc.Aggregators() {
		aggregators[a.ID()] = a.Name()
	}

	// shortcut: integrations are listed up to one page of tool.MaxLimit; a household has a handful.
	is, _, err := svc.ListIntegrations(ctx, booksID, page.Request[app.NameKey]{Limit: tool.MaxLimit})
	if err != nil {
		return nil, err
	}

	for _, i := range is {
		name := aggregators[string(i.Aggregator)]
		if name == "" {
			name = string(i.Aggregator)
		}

		out = append(out, integrationView{IntegrationID: i.ID.String(), Name: i.Name, Aggregator: name})
	}

	return out, nil
}
