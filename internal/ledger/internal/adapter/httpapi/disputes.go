package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func toDisputeAPI(d app.Dispute) Dispute {
	out := Dispute{Id: d.ID, TransactionId: d.TransactionID, OpenedOn: apiDate(d.OpenedOn), ResolvedOn: apiOptDate(d.ResolvedOn), RefundTransactionId: apiOptUUID(d.RefundTransactionID)}
	if d.Outcome != "" {
		o := DisputeOutcome(d.Outcome)
		out.Outcome = &o
	}
	return out
}

func (s *Server) OpenDispute(ctx context.Context, req OpenDisputeRequestObject) (OpenDisputeResponseObject, error) {
	d, err := s.svc.OpenDispute(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.OpenedOn))
	if err != nil {
		return nil, err
	}
	return OpenDispute201JSONResponse(toDisputeAPI(d)), nil
}

func (s *Server) ResolveDispute(ctx context.Context, req ResolveDisputeRequestObject) (ResolveDisputeResponseObject, error) {
	statement, err := optMonth("statement", req.Body.Statement)
	if err != nil {
		return nil, err
	}
	d, err := s.svc.ResolveDispute(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.ResolvedOn), string(req.Body.Outcome), statement)
	if err != nil {
		return nil, err
	}
	return ResolveDispute200JSONResponse(toDisputeAPI(d)), nil
}
