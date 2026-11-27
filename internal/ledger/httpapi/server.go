package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

const BaseURL = "/api/v1"

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	// Settings
	mux.HandleFunc(
		"GET "+BaseURL+"/settings",
		httpserver.Handle(s.errs, http.StatusOK, s.getSettings),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/settings",
		httpserver.Handle(s.errs, http.StatusOK, s.updateSettings),
	)

	// Institutions
	mux.HandleFunc(
		"GET "+BaseURL+"/institutions",
		httpserver.Handle(s.errs, http.StatusOK, s.listInstitutions),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/institutions",
		httpserver.Handle(s.errs, http.StatusCreated, s.createInstitution),
	)
	mux.HandleFunc(
		"DELETE "+BaseURL+"/institutions/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteInstitution),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/institution-identifier-schemes",
		httpserver.Handle(s.errs, http.StatusOK, s.listInstitutionIdentifierSchemes),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/institutions/{id}/identifier",
		httpserver.Handle(s.errs, http.StatusOK, s.setInstitutionIdentifier),
	)

	// Payees
	mux.HandleFunc("GET "+BaseURL+"/payees", httpserver.Handle(s.errs, http.StatusOK, s.listPayees))
	mux.HandleFunc(
		"POST "+BaseURL+"/payees",
		httpserver.Handle(s.errs, http.StatusCreated, s.createPayee),
	)
	mux.HandleFunc(
		"PATCH "+BaseURL+"/payees/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.renamePayee),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/payees/{id}/merge",
		httpserver.Handle(s.errs, http.StatusOK, s.mergePayee),
	)

	// Tags
	mux.HandleFunc("GET "+BaseURL+"/tags", httpserver.Handle(s.errs, http.StatusOK, s.listTags))
	mux.HandleFunc(
		"GET "+BaseURL+"/tags/{name}",
		httpserver.Handle(s.errs, http.StatusOK, s.getTag),
	)
	mux.HandleFunc(
		"PATCH "+BaseURL+"/tags/{name}",
		httpserver.Handle(s.errs, http.StatusOK, s.renameTag),
	)
	mux.HandleFunc(
		"DELETE "+BaseURL+"/tags/{name}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteTag),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/tags/{name}/merge",
		httpserver.Handle(s.errs, http.StatusOK, s.mergeTag),
	)

	// Accounts
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts",
		httpserver.Handle(s.errs, http.StatusOK, s.listAccounts),
	)
	mux.HandleFunc("POST "+BaseURL+"/accounts", httpserver.HandleCreated(s.errs, s.createAccount))
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getAccount),
	)
	mux.HandleFunc(
		"PATCH "+BaseURL+"/accounts/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.updateAccount),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/close",
		httpserver.Handle(s.errs, http.StatusOK, s.closeAccount),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/reopen",
		httpserver.Handle(s.errs, http.StatusOK, s.reopenAccount),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/accounts/{id}/appearance",
		httpserver.Handle(s.errs, http.StatusOK, s.setAccountAppearance),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/accounts/{id}/card-face",
		httpserver.Handle(s.errs, http.StatusOK, s.setAccountCardFace),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/accounts/{id}/parent",
		httpserver.Handle(s.errs, http.StatusOK, s.setAccountParent),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/merge",
		httpserver.Handle(s.errs, http.StatusOK, s.mergeAccount),
	)

	// Balances
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/balance",
		httpserver.Handle(s.errs, http.StatusOK, s.getAccountBalance),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/withholding",
		httpserver.Handle(s.errs, http.StatusOK, s.getAccountWithholding),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/lots",
		httpserver.Handle(s.errs, http.StatusOK, s.getAccountLots),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/balances",
		httpserver.Handle(s.errs, http.StatusOK, s.listBalances),
	)

	// Transactions
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions",
		httpserver.Handle(s.errs, http.StatusOK, s.listTransactions),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions",
		httpserver.HandleCreated(s.errs, s.createTransaction),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/foreign-purchases",
		httpserver.HandleCreated(s.errs, s.recordForeignPurchase),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/exchanges",
		httpserver.HandleCreated(s.errs, s.exchangeCurrency),
	)
	mux.HandleFunc("POST "+BaseURL+"/trades", httpserver.HandleCreated(s.errs, s.recordTrade))
	mux.HandleFunc("POST "+BaseURL+"/fixed-income-applications", s.createFixedIncomeApplication)
	mux.HandleFunc(
		"POST "+BaseURL+"/corporate-actions",
		httpserver.HandleCreated(s.errs, s.recordCorporateAction),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/custody-transfers",
		httpserver.HandleCreated(s.errs, s.recordCustodyTransfer),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/brokerage-notes",
		httpserver.HandleCreated(s.errs, s.recordBrokerageNote),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/investment-income",
		httpserver.HandleCreated(s.errs, s.recordInvestmentIncome),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/trades/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.correctTrade),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/investment-income/withholding",
		httpserver.Handle(s.errs, http.StatusOK, s.getIncomeWithholding),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/investment-income/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.correctInvestmentIncome),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getTransaction),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/transactions/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.correctTransaction),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/{id}/void",
		httpserver.Handle(s.errs, http.StatusOK, s.voidTransaction),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/categorize",
		httpserver.Handle(s.errs, http.StatusOK, s.categorizeTransactions),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/void",
		httpserver.Handle(s.errs, http.StatusOK, s.voidTransactions),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/{id}/categorize",
		httpserver.Handle(s.errs, http.StatusOK, s.categorizeTransaction),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/{id}/transfer",
		httpserver.Handle(s.errs, http.StatusOK, s.transferTransaction),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/{id}/reimbursement",
		httpserver.Handle(s.errs, http.StatusOK, s.reimburseTransaction),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions/{id}/reimbursement-candidates",
		httpserver.Handle(s.errs, http.StatusOK, s.listReimbursementCandidates),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions/{id}/reimbursement-sources",
		httpserver.Handle(s.errs, http.StatusOK, s.listReimbursementSources),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions/{id}/versions",
		httpserver.Handle(s.errs, http.StatusOK, s.listTransactionVersions),
	)

	// Billing cycles and credit limits
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/billing-cycle-rules",
		httpserver.Handle(s.errs, http.StatusOK, s.listBillingCycleRules),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/billing-cycle-rules",
		httpserver.Handle(s.errs, http.StatusCreated, s.createBillingCycleRule),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/statement-placement",
		httpserver.Handle(s.errs, http.StatusOK, s.getStatementPlacement),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/credit-limits",
		httpserver.Handle(s.errs, http.StatusOK, s.listCreditLimits),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/credit-limits",
		httpserver.Handle(s.errs, http.StatusCreated, s.createCreditLimit),
	)

	// Cards
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/cards",
		httpserver.Handle(s.errs, http.StatusOK, s.listCards),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/cards",
		httpserver.Handle(s.errs, http.StatusCreated, s.createCard),
	)
	mux.HandleFunc(
		"PATCH "+BaseURL+"/cards/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.updateCard),
	)
	mux.HandleFunc(
		"DELETE "+BaseURL+"/cards/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteCard),
	)

	// Statements, installments and refunds
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/statements",
		httpserver.Handle(s.errs, http.StatusOK, s.listStatements),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/statements/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getStatement),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/installment-purchases",
		httpserver.Handle(s.errs, http.StatusCreated, s.createInstallmentPurchase),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transaction-batches",
		httpserver.Handle(s.errs, http.StatusCreated, s.createTransactionBatch),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/commitments",
		httpserver.Handle(s.errs, http.StatusOK, s.getCommitment),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/statements/{id}/payments",
		httpserver.HandleCreated(s.errs, s.payStatement),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/statements/{id}/financing",
		httpserver.Handle(s.errs, http.StatusCreated, s.financeStatement),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/{id}/refunds",
		httpserver.HandleCreated(s.errs, s.refundTransaction),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/installment-plans/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getInstallmentPlan),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/installment-plans/{id}/cancellation",
		httpserver.HandleCreated(s.errs, s.cancelInstallmentPlan),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/installment-plans/{id}/anticipation",
		httpserver.HandleCreated(s.errs, s.anticipateInstallments),
	)

	// Disputes
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions/{id}/disputes",
		httpserver.Handle(s.errs, http.StatusOK, s.listDisputes),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/transactions/{id}/disputes",
		httpserver.Handle(s.errs, http.StatusCreated, s.openDispute),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/disputes/{id}/resolve",
		httpserver.Handle(s.errs, http.StatusOK, s.resolveDispute),
	)

	// Reconciliation
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/balance-assertions",
		httpserver.Handle(s.errs, http.StatusOK, s.listBalanceAssertions),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/balance-assertions",
		httpserver.Handle(s.errs, http.StatusCreated, s.createBalanceAssertion),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/balance-assertions/{id}/resolve",
		httpserver.Handle(s.errs, http.StatusOK, s.resolveBalanceAssertion),
	)
	mux.HandleFunc(
		"GET "+BaseURL+"/accounts/{id}/reconciliation",
		httpserver.Handle(s.errs, http.StatusOK, s.getReconciliationStatus),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/accounts/{id}/unlock",
		httpserver.Handle(s.errs, http.StatusOK, s.unlockAccount),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/statements/{id}/reconcile",
		httpserver.Handle(s.errs, http.StatusOK, s.reconcileStatement),
	)
	mux.HandleFunc(
		"POST "+BaseURL+"/statements/{id}/defer",
		httpserver.Handle(s.errs, http.StatusOK, s.deferStatementPostings),
	)
	mux.HandleFunc(
		"PUT "+BaseURL+"/statements/{id}/facts",
		httpserver.Handle(s.errs, http.StatusOK, s.setStatementFacts),
	)
	mux.HandleFunc(
		"DELETE "+BaseURL+"/statements/{id}/facts",
		httpserver.Handle(s.errs, http.StatusOK, s.removeStatementFacts),
	)

	// Investment file
	mux.HandleFunc("POST "+BaseURL+"/brokerages/{id}/investment-file", s.importInvestmentFile)

	// Attachments
	mux.HandleFunc(
		"GET "+BaseURL+"/transactions/{id}/attachments",
		httpserver.Handle(s.errs, http.StatusOK, s.listAttachments),
	)
	mux.HandleFunc("POST "+BaseURL+"/transactions/{id}/attachments", s.createAttachment)
	mux.HandleFunc(
		"DELETE "+BaseURL+"/attachments/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteAttachment),
	)
	mux.HandleFunc("GET "+BaseURL+"/attachments/{id}/content", s.getAttachmentContent)
}
