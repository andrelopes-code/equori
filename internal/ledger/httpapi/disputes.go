package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func toDisputeAPI(d app.Dispute) Dispute {
	out := Dispute{
		Id:                  d.ID,
		TransactionId:       d.TransactionID,
		OpenedOn:            apiDate(d.OpenedOn),
		ResolvedOn:          apiOptDate(d.ResolvedOn),
		RefundTransactionId: apiOptUUID(d.RefundTransactionID),
	}
	if d.Outcome != "" {
		o := DisputeOutcome(d.Outcome)
		out.Outcome = &o
	}

	return out
}

func (s *Server) listDisputes(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (DisputeList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return DisputeList{}, err
	}

	disputes, err := s.svc.Disputes(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return DisputeList{}, err
	}

	out := DisputeList{Items: make([]Dispute, len(disputes))}
	for i, d := range disputes {
		out.Items[i] = toDisputeAPI(d)
	}

	return out, nil
}

func (s *Server) openDispute(
	ctx context.Context,
	r *http.Request,
	in OpenDisputeJSONRequestBody,
) (Dispute, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Dispute{}, err
	}

	d, err := s.svc.OpenDispute(ctx, auth.MustBooksID(ctx), id, dateOf(in.OpenedOn))
	if err != nil {
		return Dispute{}, err
	}

	return toDisputeAPI(d), nil
}

func (s *Server) resolveDispute(
	ctx context.Context,
	r *http.Request,
	in ResolveDisputeJSONRequestBody,
) (Dispute, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Dispute{}, err
	}

	statement, err := optMonth("statement", in.Statement)
	if err != nil {
		return Dispute{}, err
	}

	d, err := s.svc.ResolveDispute(
		ctx,
		auth.MustBooksID(ctx),
		id,
		dateOf(in.ResolvedOn),
		string(in.Outcome),
		statement,
	)
	if err != nil {
		return Dispute{}, err
	}

	return toDisputeAPI(d), nil
}
