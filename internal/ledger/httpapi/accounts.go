package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) ListAccounts(ctx context.Context, req ListAccountsRequestObject) (ListAccountsResponseObject, error) {
	p, err := listPage[app.AccountKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}

	booksID := auth.MustBooksID(ctx)

	rows, next, err := s.svc.ListAccounts(ctx, booksID, p)
	if err != nil {
		return nil, err
	}

	out := ListAccounts200JSONResponse{Items: make([]Account, len(rows))}
	for i, r := range rows {
		if out.Items[i], err = s.accountAPI(ctx, booksID, r); err != nil {
			return nil, err
		}
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) CreateAccount(ctx context.Context, req CreateAccountRequestObject) (CreateAccountResponseObject, error) {
	a, err := s.svc.CreateAccount(ctx, auth.MustBooksID(ctx), fromAccountInput(*req.Body))
	if err != nil {
		return nil, err
	}

	return CreateAccount201JSONResponse{Body: toAccountAPI(a), Headers: CreateAccount201ResponseHeaders{Location: location("/accounts/", a.ID)}}, nil
}

func (s *Server) GetAccount(ctx context.Context, req GetAccountRequestObject) (GetAccountResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	a, err := s.svc.Account(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	out, err := s.accountAPI(ctx, booksID, a)
	if err != nil {
		return nil, err
	}

	return GetAccount200JSONResponse(out), nil
}

// accountAPI is an account with the limits of a card, when it is one with a credit limit.
func (s *Server) accountAPI(ctx context.Context, booksID int64, a domain.Account) (Account, error) {
	out := toAccountAPI(a)

	summary, err := s.svc.CardSummary(ctx, booksID, a)
	if err != nil {
		return Account{}, err
	}

	if summary != nil {
		limit, available := toMoneyAPI(summary.CreditLimit), toMoneyAPI(summary.AvailableLimit)
		out.Card = &CardSummary{CreditLimit: &limit, AvailableLimit: &available}
	}

	return out, nil
}

func (s *Server) UpdateAccount(ctx context.Context, req UpdateAccountRequestObject) (UpdateAccountResponseObject, error) {
	patch := app.AccountPatch{
		Name: req.Body.Name, ParentID: req.Body.ParentId, InstitutionID: req.Body.InstitutionId,
		ExcludedFromLiquidity: req.Body.ExcludedFromLiquidity,
	}
	if req.Body.OpenedOn != nil {
		patch.OpenedOn = &req.Body.OpenedOn.Time
	}

	if req.Body.YieldMode != nil {
		mode := domain.YieldMode(*req.Body.YieldMode)
		patch.YieldMode = &mode
	}

	a, err := s.svc.UpdateAccount(ctx, auth.MustBooksID(ctx), req.Id, patch)
	if err != nil {
		return nil, err
	}

	return UpdateAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) CloseAccount(ctx context.Context, req CloseAccountRequestObject) (CloseAccountResponseObject, error) {
	booksID := auth.MustBooksID(ctx)
	if err := s.svc.CloseAccount(ctx, booksID, req.Id, dateOf(req.Body.ClosedOn)); err != nil {
		return nil, err
	}

	a, err := s.svc.Account(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	return CloseAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) SetAccountAppearance(ctx context.Context, req SetAccountAppearanceRequestObject) (SetAccountAppearanceResponseObject, error) {
	var color int
	var icon string

	if req.Body.Color != nil {
		color = *req.Body.Color
	}

	if req.Body.Icon != nil {
		icon = string(*req.Body.Icon)
	}

	a, err := s.svc.SetAppearance(ctx, auth.MustBooksID(ctx), req.Id, color, icon)
	if err != nil {
		return nil, err
	}

	return SetAccountAppearance200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) SetAccountParent(ctx context.Context, req SetAccountParentRequestObject) (SetAccountParentResponseObject, error) {
	var parent uuid.UUID
	if req.Body.ParentId != nil {
		parent = *req.Body.ParentId
	}

	a, err := s.svc.UpdateAccount(ctx, auth.MustBooksID(ctx), req.Id, app.AccountPatch{ParentID: &parent})
	if err != nil {
		return nil, err
	}

	return SetAccountParent200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) MergeAccount(ctx context.Context, req MergeAccountRequestObject) (MergeAccountResponseObject, error) {
	a, err := s.svc.MergeCategories(ctx, auth.MustBooksID(ctx), req.Id, req.Body.Into)
	if err != nil {
		return nil, err
	}

	return MergeAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) ReopenAccount(ctx context.Context, req ReopenAccountRequestObject) (ReopenAccountResponseObject, error) {
	a, err := s.svc.ReopenAccount(ctx, auth.MustBooksID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	return ReopenAccount200JSONResponse(toAccountAPI(a)), nil
}
