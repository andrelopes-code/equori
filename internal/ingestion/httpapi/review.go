package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toRecordAPI(r domain.ExternalRecord, currency string) ExternalRecord {
	out := ExternalRecord{
		Id: r.ID, BatchId: r.BatchID, AccountId: r.AccountID, Date: openapi_types.Date{Time: r.Date},
		Amount: Money{Amount: r.Amount, Currency: currency}, Description: r.Description,
		State: ExternalRecordState(r.State), ExternalId: ref(r.ExternalID), Candidates: make([]openapi_types.UUID, len(r.Candidates)),
		UnappliedChange: ref(r.UnappliedChange),
	}
	copy(out.Candidates, r.Candidates)

	if r.ReviewReason != "" {
		reason := ExternalRecordReviewReason(r.ReviewReason)
		out.ReviewReason = &reason
	}

	if len(r.Scores) > 0 {
		scored := make([]ScoredCandidate, len(r.Scores))
		for i, s := range r.Scores {
			scored[i] = ScoredCandidate{
				TransactionId: s.TransactionID, Score: s.Score, Amount: ScoredCandidateAmount(s.Amount),
				Date: ScoredCandidateDate(s.Date), Counterparty: ScoredCandidateCounterparty(s.Counterparty),
			}
		}

		out.ScoredCandidates = &scored
	}

	if len(r.GroupIDs) > 0 {
		out.GroupRecordIds = &r.GroupIDs
	}

	if r.TransactionID != uuid.Nil {
		out.TransactionId = &r.TransactionID
	}

	if r.Decision != "" {
		decision := ExternalRecordDecision(r.Decision)
		out.Decision = &decision
	}

	return out
}

func (s *Server) listBatchRecords(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (ExternalRecordList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ExternalRecordList{}, err
	}

	params, err := httpserver.Query[ListBatchRecordsParams](r)
	if err != nil {
		return ExternalRecordList{}, err
	}

	p, err := listPage[app.RecordKey](params.Limit, params.Cursor)
	if err != nil {
		return ExternalRecordList{}, err
	}

	var state domain.RecordState
	if params.State != nil {
		state = domain.RecordState(*params.State)
	}

	recs, next, b, err := s.svc.Records(ctx, auth.MustBooksID(ctx), id, state, p)
	if err != nil {
		return ExternalRecordList{}, err
	}

	out := ExternalRecordList{Items: make([]ExternalRecord, len(recs))}
	for i, rec := range recs {
		out.Items[i] = toRecordAPI(rec, b.Currency)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) resolveExternalRecord(
	ctx context.Context, r *http.Request, in ResolveExternalRecordJSONRequestBody,
) (ExternalRecord, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ExternalRecord{}, err
	}

	var txID uuid.UUID
	if in.TransactionId != nil {
		txID = *in.TransactionId
	}

	rec, b, err := s.svc.Resolve(ctx, auth.MustBooksID(ctx), id, string(in.Action), txID)
	if err != nil {
		return ExternalRecord{}, err
	}

	return toRecordAPI(rec, b.Currency), nil
}

func (s *Server) resolveExternalRecords(
	ctx context.Context, _ *http.Request, in ResolveExternalRecordsJSONRequestBody,
) (BulkResolveResult, error) {
	items := make([]app.Resolution, len(in.Items))
	for i, it := range in.Items {
		items[i] = app.Resolution{RecordID: it.RecordId, Action: string(it.Resolution.Action)}
		if it.Resolution.TransactionId != nil {
			items[i].TransactionID = *it.Resolution.TransactionId
		}
	}

	errs, err := s.svc.ResolveMany(ctx, auth.MustBooksID(ctx), items)
	if err != nil {
		return BulkResolveResult{}, err
	}

	out := BulkResolveResult{Results: make([]BulkResolveItemResult, len(items))}
	for i, it := range items {
		status, ok := resolveStatus(errs[i])
		if !ok {
			return BulkResolveResult{}, errs[i]
		}

		out.Results[i] = BulkResolveItemResult{RecordId: it.RecordID, Status: status}
	}

	return out, nil
}

// resolveStatus names an item error by the problem code of the same failure (A201); ok is
// false for an error outside the status list.
func resolveStatus(err error) (BulkResolveItemResultStatus, bool) {
	if err == nil {
		return Resolved, true
	}

	d, known := ToProblem(err)
	status := BulkResolveItemResultStatus(d.Code)

	return status, known && status.Valid()
}

func (s *Server) reopenExternalRecord(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (ExternalRecord, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ExternalRecord{}, err
	}

	rec, b, err := s.svc.Reopen(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ExternalRecord{}, err
	}

	return toRecordAPI(rec, b.Currency), nil
}

func (s *Server) listUnconfirmed(ctx context.Context, r *http.Request, _ httpserver.None) (UnconfirmedList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return UnconfirmedList{}, err
	}

	ps, currency, err := s.svc.Unconfirmed(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return UnconfirmedList{}, err
	}

	out := UnconfirmedList{Items: make([]UnconfirmedEntry, len(ps))}
	for i, p := range ps {
		out.Items[i] = UnconfirmedEntry{
			TransactionId: p.TransactionID, Date: openapi_types.Date{Time: p.Date},
			Amount: Money{Amount: p.Amount, Currency: string(currency)}, Description: p.Description,
		}
		if p.PayeeID != uuid.Nil {
			out.Items[i].PayeeId = &p.PayeeID
		}

		if p.StatementID != uuid.Nil {
			out.Items[i].StatementId = &p.StatementID
		}
	}

	return out, nil
}

func (s *Server) undoExternalRecordDecision(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (ExternalRecord, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ExternalRecord{}, err
	}

	rec, b, err := s.svc.UndoDecision(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ExternalRecord{}, err
	}

	return toRecordAPI(rec, b.Currency), nil
}
