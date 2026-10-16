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
	}
	copy(out.Candidates, r.Candidates)
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
