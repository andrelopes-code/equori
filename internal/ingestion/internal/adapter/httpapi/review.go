package httpapi

import (
	"context"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
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
	if r.TransactionID != uuid.Nil {
		out.TransactionId = &r.TransactionID
	}
	return out
}

func (s *Server) ListBatchRecords(ctx context.Context, req ListBatchRecordsRequestObject) (ListBatchRecordsResponseObject, error) {
	p, err := listPage[app.RecordKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	var state domain.RecordState
	if req.Params.State != nil {
		state = domain.RecordState(*req.Params.State)
	}
	recs, next, b, err := s.svc.Records(ctx, auth.MustUserID(ctx), req.Id, state, p)
	if err != nil {
		return nil, err
	}
	out := ListBatchRecords200JSONResponse{Items: make([]ExternalRecord, len(recs))}
	for i, r := range recs {
		out.Items[i] = toRecordAPI(r, b.Currency)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) ResolveExternalRecord(ctx context.Context, req ResolveExternalRecordRequestObject) (ResolveExternalRecordResponseObject, error) {
	var txID uuid.UUID
	if req.Body.TransactionId != nil {
		txID = *req.Body.TransactionId
	}
	rec, b, err := s.svc.Resolve(ctx, auth.MustUserID(ctx), req.Id, string(req.Body.Action), txID)
	if err != nil {
		return nil, err
	}
	return ResolveExternalRecord200JSONResponse(toRecordAPI(rec, b.Currency)), nil
}

func (s *Server) ReopenExternalRecord(ctx context.Context, req ReopenExternalRecordRequestObject) (ReopenExternalRecordResponseObject, error) {
	rec, b, err := s.svc.Reopen(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	return ReopenExternalRecord200JSONResponse(toRecordAPI(rec, b.Currency)), nil
}

func (s *Server) ListUnconfirmed(ctx context.Context, req ListUnconfirmedRequestObject) (ListUnconfirmedResponseObject, error) {
	ps, currency, err := s.svc.Unconfirmed(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out := ListUnconfirmed200JSONResponse{Items: make([]UnconfirmedEntry, len(ps))}
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
