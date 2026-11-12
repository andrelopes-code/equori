package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) listAccounts(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AccountList, error) {
	params, err := httpserver.Query[ListAccountsParams](r)
	if err != nil {
		return AccountList{}, err
	}

	p, err := listPage[app.AccountKey](params.Limit, params.Cursor)
	if err != nil {
		return AccountList{}, err
	}

	booksID := auth.MustBooksID(ctx)

	rows, next, err := s.svc.ListAccounts(ctx, booksID, p)
	if err != nil {
		return AccountList{}, err
	}

	out := AccountList{Items: make([]Account, len(rows))}
	for i, rec := range rows {
		if out.Items[i], err = s.accountAPI(ctx, booksID, rec); err != nil {
			return AccountList{}, err
		}
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) createAccount(
	ctx context.Context,
	r *http.Request,
	in CreateAccountJSONRequestBody,
) (Account, string, error) {
	a, err := s.svc.CreateAccount(ctx, auth.MustBooksID(ctx), fromAccountInput(in))
	if err != nil {
		return Account{}, "", err
	}

	return toAccountAPI(a), location("/accounts/", a.ID), nil
}

func (s *Server) getAccount(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	booksID := auth.MustBooksID(ctx)

	a, err := s.svc.Account(ctx, booksID, id)
	if err != nil {
		return Account{}, err
	}

	out, err := s.accountAPI(ctx, booksID, a)
	if err != nil {
		return Account{}, err
	}

	return out, nil
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

func (s *Server) updateAccount(
	ctx context.Context,
	r *http.Request,
	in UpdateAccountJSONRequestBody,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	patch := app.AccountPatch{
		Name: in.Name, ParentID: in.ParentId, InstitutionID: in.InstitutionId,
		ExcludedFromLiquidity: in.ExcludedFromLiquidity,
	}
	if in.OpenedOn != nil {
		patch.OpenedOn = &in.OpenedOn.Time
	}

	if in.YieldMode != nil {
		mode := domain.YieldMode(*in.YieldMode)
		patch.YieldMode = &mode
	}

	a, err := s.svc.UpdateAccount(ctx, auth.MustBooksID(ctx), id, patch)
	if err != nil {
		return Account{}, err
	}

	return toAccountAPI(a), nil
}

func (s *Server) closeAccount(
	ctx context.Context,
	r *http.Request,
	in CloseAccountJSONRequestBody,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	booksID := auth.MustBooksID(ctx)
	if err := s.svc.CloseAccount(ctx, booksID, id, dateOf(in.ClosedOn)); err != nil {
		return Account{}, err
	}

	a, err := s.svc.Account(ctx, booksID, id)
	if err != nil {
		return Account{}, err
	}

	return toAccountAPI(a), nil
}

func (s *Server) setAccountAppearance(
	ctx context.Context,
	r *http.Request,
	in SetAccountAppearanceJSONRequestBody,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	var color int
	var icon string

	if in.Color != nil {
		color = *in.Color
	}

	if in.Icon != nil {
		icon = string(*in.Icon)
	}

	a, err := s.svc.SetAppearance(ctx, auth.MustBooksID(ctx), id, color, icon)
	if err != nil {
		return Account{}, err
	}

	return toAccountAPI(a), nil
}

func (s *Server) setAccountParent(
	ctx context.Context,
	r *http.Request,
	in SetAccountParentJSONRequestBody,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	var parent uuid.UUID
	if in.ParentId != nil {
		parent = *in.ParentId
	}

	a, err := s.svc.UpdateAccount(
		ctx,
		auth.MustBooksID(ctx),
		id,
		app.AccountPatch{ParentID: &parent},
	)
	if err != nil {
		return Account{}, err
	}

	return toAccountAPI(a), nil
}

func (s *Server) mergeAccount(
	ctx context.Context,
	r *http.Request,
	in MergeAccountJSONRequestBody,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	a, err := s.svc.MergeCategories(ctx, auth.MustBooksID(ctx), id, in.Into)
	if err != nil {
		return Account{}, err
	}

	return toAccountAPI(a), nil
}

func (s *Server) reopenAccount(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Account, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Account{}, err
	}

	a, err := s.svc.ReopenAccount(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Account{}, err
	}

	return toAccountAPI(a), nil
}
