package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getTransactionIn struct {
	TransactionID        string `json:"transaction_id"                 jsonschema:"ID of the transaction, from search_transactions"`
	IncludeReimbursement bool   `json:"include_reimbursement,omitzero" jsonschema:"also list the incoming transactions that can repay this expense, or the expenses this incoming transaction can repay"`
}

type linkView struct {
	Type          string     `json:"type"`
	TransactionID string     `json:"transaction_id"`
	Amount        tool.Money `json:"amount,omitzero"`
}

type transactionDetailView struct {
	transactionView
	Version      int        `json:"version"`
	Links        []linkView `json:"links"`
	ReferencedBy []linkView `json:"referenced_by"`
}

type historyEntry struct {
	Version    int    `json:"version"`
	Reason     string `json:"reason,omitzero"`
	ReplacedAt string `json:"replaced_at"     jsonschema:"RFC 3339 timestamp"`
}

type attachmentView struct {
	FileName string `json:"file_name"`
	Size     int64  `json:"size"`
}

type disputeView struct {
	DisputeID  string    `json:"dispute_id"`
	OpenedOn   tool.Date `json:"opened_on"`
	Outcome    string    `json:"outcome,omitzero"`
	ResolvedOn tool.Date `json:"resolved_on,omitzero"`
}

type installmentView struct {
	Number    int        `json:"number"`
	Amount    tool.Money `json:"amount"`
	Statement string     `json:"statement" jsonschema:"reference month of the statement, YYYY-MM"`
	Reversed  bool       `json:"reversed"`
}

type installmentPlanView struct {
	PlanID       string            `json:"plan_id"`
	Count        int               `json:"count"`
	Status       string            `json:"status"`
	Installments []installmentView `json:"installments"`
}

type candidateView struct {
	TransactionID string     `json:"transaction_id"`
	Date          tool.Date  `json:"date"`
	Description   string     `json:"description"`
	Remaining     tool.Money `json:"remaining"`
}

type sourceView struct {
	TransactionID string     `json:"transaction_id"`
	Date          tool.Date  `json:"date"`
	Description   string     `json:"description"`
	Free          tool.Money `json:"free"`
}

type getTransactionOut struct {
	Transaction            transactionDetailView `json:"transaction"`
	History                []historyEntry        `json:"history"`
	Attachments            []attachmentView      `json:"attachments"`
	Disputes               []disputeView         `json:"disputes"`
	InstallmentPlan        installmentPlanView   `json:"installment_plan,omitzero"`
	ReimbursementCandidate []candidateView       `json:"reimbursement_candidates,omitzero"`
	ReimbursementSources   []sourceView          `json:"reimbursement_sources,omitzero"`
}

func getTransaction(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_transaction",
		Description: "Returns one transaction in full: postings, links to refunds and reimbursements, earlier versions with their reasons, attachment names, disputes and, for an installment purchase, its plan. " +
			"Use it before changing a transaction or to explain its history. " +
			"Do not use it to find transactions: search_transactions does.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getTransactionIn) (getTransactionOut, error) {
		return runGetTransaction(ctx, svc, booksID, in)
	})
}

func runGetTransaction(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getTransactionIn,
) (getTransactionOut, error) {
	id, err := requiredID(in.TransactionID, "transaction_id")
	if err != nil {
		return getTransactionOut{}, err
	}

	t, err := svc.Transaction(ctx, booksID, id)
	if err != nil {
		return getTransactionOut{}, err
	}

	src, err := loadTransactionSources(ctx, svc, booksID, t)
	if err != nil {
		return getTransactionOut{}, err
	}

	out, err := transactionOutOf(t, src)
	if err != nil {
		return getTransactionOut{}, err
	}

	if out.InstallmentPlan, err = installmentPlanOf(ctx, svc, booksID, t); err != nil {
		return getTransactionOut{}, err
	}

	if in.IncludeReimbursement {
		err = reimbursementsOf(ctx, svc, booksID, id, &out)
	}

	return out, err
}

// transactionSources holds what get_transaction reads besides the transaction itself.
type transactionSources struct {
	accounts    map[uuid.UUID]domain.Account
	versions    []app.Version
	attachments []app.Attachment
	disputes    []app.Dispute
	refs        []app.Reference
	payees      map[uuid.UUID]string
}

func loadTransactionSources(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	t domain.Transaction,
) (transactionSources, error) {
	var src transactionSources

	var err error
	if src.accounts, _, err = allAccounts(ctx, svc, booksID); err != nil {
		return src, err
	}

	if src.versions, err = svc.Versions(ctx, booksID, t.ID); err != nil {
		return src, err
	}

	if src.attachments, _, err = svc.Attachments(
		ctx,
		booksID,
		t.ID,
		page.Request[app.AttachmentKey]{Limit: 20},
	); err != nil {
		return src, err
	}

	if src.disputes, err = svc.Disputes(ctx, booksID, t.ID); err != nil {
		return src, err
	}

	if src.refs, err = svc.ReferencedBy(ctx, booksID, t.ID); err != nil {
		return src, err
	}

	payeeIDs := []uuid.UUID{}
	if t.PayeeID != uuid.Nil {
		payeeIDs = append(payeeIDs, t.PayeeID)
	}

	src.payees, err = svc.PayeeNames(ctx, booksID, payeeIDs)

	return src, err
}

func transactionOutOf(t domain.Transaction, src transactionSources) (getTransactionOut, error) {
	out := getTransactionOut{
		History: []historyEntry{}, Attachments: []attachmentView{}, Disputes: []disputeView{},
	}

	out.Transaction = transactionDetailView{
		transactionView: viewOf(t, src.accounts, src.payees), Version: t.Version,
		Links: []linkView{}, ReferencedBy: []linkView{},
	}
	for _, l := range t.Links {
		v, err := linkOf(string(l.Type), l.Target, l.Amount, t.BalancingCurrency)
		if err != nil {
			return getTransactionOut{}, err
		}

		out.Transaction.Links = append(out.Transaction.Links, v)
	}

	for _, r := range src.refs {
		v, err := linkOf(string(r.Type), r.Source, r.Amount, money.Currency(r.Currency))
		if err != nil {
			return getTransactionOut{}, err
		}

		out.Transaction.ReferencedBy = append(out.Transaction.ReferencedBy, v)
	}

	out.History = append(out.History, historyEntries(src.versions)...)
	out.Attachments = append(out.Attachments, attachmentViews(src.attachments)...)
	out.Disputes = append(out.Disputes, disputeViews(src.disputes)...)

	return out, nil
}

func historyEntries(versions []app.Version) []historyEntry {
	var out []historyEntry
	for _, v := range versions {
		out = append(
			out,
			historyEntry{
				Version:    v.Version,
				Reason:     v.Reason,
				ReplacedAt: v.ReplacedAt.Format(time.RFC3339),
			},
		)
	}

	return out
}

func attachmentViews(attachments []app.Attachment) []attachmentView {
	var out []attachmentView
	for _, a := range attachments {
		out = append(out, attachmentView{FileName: a.FileName, Size: a.Size})
	}

	return out
}

func disputeViews(disputes []app.Dispute) []disputeView {
	var out []disputeView
	for _, d := range disputes {
		v := disputeView{
			DisputeID: d.ID.String(),
			OpenedOn:  tool.DateOf(d.OpenedOn),
			Outcome:   d.Outcome,
		}
		if d.ResolvedOn != nil {
			v.ResolvedOn = tool.DateOf(*d.ResolvedOn)
		}

		out = append(out, v)
	}

	return out
}

func linkOf(
	kind string,
	target uuid.UUID,
	amount int64,
	currency money.Currency,
) (linkView, error) {
	v := linkView{Type: kind, TransactionID: target.String()}
	if amount == 0 {
		return v, nil
	}

	m, err := money.New(amount, currency)
	if err != nil {
		return v, err
	}

	v.Amount = tool.MoneyOf(m)

	return v, nil
}

func installmentPlanOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	t domain.Transaction,
) (installmentPlanView, error) {
	for _, p := range t.Postings {
		if p.Installment == nil {
			continue
		}

		plan, err := svc.InstallmentPlan(ctx, booksID, p.Installment.PlanID)
		if err != nil {
			return installmentPlanView{}, err
		}

		out := installmentPlanView{
			PlanID:       plan.Plan.ID.String(),
			Count:        plan.Plan.Count,
			Status:       plan.Status,
			Installments: []installmentView{},
		}
		for _, i := range plan.Installments {
			amount, err := minorMoney(plan.Plan.Principal, i.Amount)
			if err != nil {
				return installmentPlanView{}, err
			}

			out.Installments = append(
				out.Installments,
				installmentView{
					Number:    i.Number,
					Amount:    amount,
					Statement: i.Reference.String(),
					Reversed:  i.Reversed,
				},
			)
		}

		return out, nil
	}

	return installmentPlanView{}, nil
}

func reimbursementsOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
	out *getTransactionOut,
) error {
	candidates, _, err := svc.ReimbursementCandidates(ctx, booksID, id)
	if err != nil {
		return err
	}

	for _, c := range candidates {
		out.ReimbursementCandidate = append(out.ReimbursementCandidate, candidateView{
			TransactionID: c.Transaction.ID.String(), Date: tool.DateOf(c.Transaction.Date),
			Description: c.Transaction.Description, Remaining: tool.MoneyOf(c.Remaining),
		})
	}

	sources, err := svc.ReimbursementSources(ctx, booksID, id)
	if err != nil {
		return err
	}

	for _, s := range sources {
		out.ReimbursementSources = append(out.ReimbursementSources, sourceView{
			TransactionID: s.Transaction.ID.String(), Date: tool.DateOf(s.Transaction.Date),
			Description: s.Transaction.Description, Free: tool.MoneyOf(s.Free),
		})
	}

	return nil
}

// requiredID parses an identifier the tool cannot run without.
func requiredID(s, field string) (uuid.UUID, error) {
	id, err := optionalID(s, field)
	if err == nil && id == uuid.Nil {
		return id, tool.InvalidArgument(field, "is required")
	}

	return id, err
}
