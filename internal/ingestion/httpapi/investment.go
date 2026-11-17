package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listConnectionInvestments(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (InvestmentList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return InvestmentList{}, err
	}

	views, err := s.svc.Investments(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return InvestmentList{}, err
	}

	out := InvestmentList{Investments: make([]ExternalInvestment, len(views))}
	for i, v := range views {
		out.Investments[i] = toInvestmentAPI(v)
	}

	return out, nil
}

func (s *Server) confirmInvestmentMovement(
	ctx context.Context, r *http.Request, b ConfirmInvestmentMovementJSONRequestBody,
) (InvestmentMovement, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return InvestmentMovement{}, err
	}

	v, err := s.svc.ConfirmMovement(
		ctx,
		auth.MustBooksID(ctx),
		id,
		optionalID(b.BrokerageId),
		optionalID(b.CashAccountId),
		optionalID(b.CategoryId),
	)

	return movementOf(v, err)
}

func (s *Server) dismissInvestmentMovement(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (InvestmentMovement, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return InvestmentMovement{}, err
	}

	v, err := s.svc.DismissMovement(ctx, auth.MustBooksID(ctx), id)

	return movementOf(v, err)
}

func (s *Server) undoInvestmentMovement(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (InvestmentMovement, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return InvestmentMovement{}, err
	}

	v, err := s.svc.UndoMovement(ctx, auth.MustBooksID(ctx), id)

	return movementOf(v, err)
}

func movementOf(v app.MovementView, err error) (InvestmentMovement, error) {
	if err != nil {
		return InvestmentMovement{}, err
	}

	return toInvestmentMovementAPI(v.InvestmentID, v.Movement, v.Proposal), nil
}

func optionalID(id *uuid.UUID) uuid.UUID {
	if id == nil {
		return uuid.Nil
	}

	return *id
}

func toInvestmentAPI(v app.InvestmentView) ExternalInvestment {
	src := v.Source
	out := ExternalInvestment{
		Id:               v.ID,
		Name:             src.Name,
		Type:             src.Type,
		Subtype:          src.Subtype,
		Issuer:           src.Issuer,
		IndexId:          src.IndexID,
		PercentOfIndexBp: src.PercentOfIndexBP,
		SpreadBp:         src.SpreadBP,
		HasTerms:         src.HasTerms,
		IssuedOn:         apiDate(src.IssuedOn),
		MaturesOn:        apiDate(src.MaturesOn),
		Balance:          apiMoney(src.Balance.Amount(), string(src.Balance.Currency())),
		BalanceDate:      openapi_types.Date{Time: src.BalanceDate},
		Instrument:       v.Instrument,
		BrokerageId:      v.BrokerageID,
		Movements:        make([]InvestmentMovement, len(v.Movements)),
	}

	for i, m := range v.Movements {
		out.Movements[i] = toInvestmentMovementAPI(v.ID, m, v.Proposals[i])
	}

	return out
}

func toInvestmentMovementAPI(
	investmentID uuid.UUID,
	m domain.StoredMovement,
	p domain.Proposal,
) InvestmentMovement {
	out := InvestmentMovement{
		Id:            m.ID,
		InvestmentId:  investmentID,
		Kind:          m.Kind,
		Date:          openapi_types.Date{Time: m.Date},
		Amount:        apiMoney(m.Amount.Amount(), string(m.Amount.Currency())),
		State:         InvestmentMovementState(m.State),
		Proposal:      p.Kind,
		TransactionId: m.TransactionID,
	}
	if p.Taxes != 0 {
		out.Taxes = new(apiMoney(p.Taxes, string(m.Amount.Currency())))
	}

	return out
}

func apiDate(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}

	return &openapi_types.Date{Time: *t}
}

func apiMoney(amount int64, currency string) Money {
	return Money{Amount: amount, Currency: currency}
}
