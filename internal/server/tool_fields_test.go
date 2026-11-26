package server_test

import (
	"maps"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/google/jsonschema-go/jsonschema"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestToolFieldCoverage compares the request fields of each write operation with the input
// fields of the tools that cover it. A field with no tool input of the same name is listed in
// uncoveredFields with the reason; a listed field that a tool now reads fails the test, so the
// list only shrinks. The comparison is by name: a field that a tool reads under another name,
// or that the tool derives, is listed as such.
func TestToolFieldCoverage(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	doc, err := openapi3.NewLoader().LoadFromData(api.Contract)
	if err != nil {
		t.Fatal(err)
	}

	got := map[string][]string{}

	for _, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			names, ok := exposure[op.OperationID]
			if !ok || strings.HasPrefix(names, "-") || method == http.MethodGet ||
				op.RequestBody == nil {
				continue
			}

			inputs := map[string]bool{}

			for name := range strings.SplitSeq(names, ",") {
				tl, ok := h.App.Tools.Tool(name)
				if !ok {
					t.Fatalf("tool %s is missing", name)
				}

				collectProperties(tl.InputSchema(), inputs)
			}

			for field := range requestFields(op.RequestBody.Value) {
				if !inputs[field] {
					got[op.OperationID] = append(got[op.OperationID], field)
				}
			}
		}
	}

	for op, fields := range got {
		slices.Sort(fields)

		want := uncoveredFields[op]
		if !slices.Equal(fields, want) {
			t.Errorf(
				"operation %s: request fields with no tool input = %v; uncoveredFields lists %v",
				op,
				fields,
				want,
			)
		}
	}

	for _, op := range slices.Sorted(maps.Keys(uncoveredFields)) {
		if _, ok := got[op]; !ok {
			t.Errorf(
				"uncoveredFields lists %s, whose request fields every tool input now reads",
				op,
			)
		}
	}
}

func requestFields(body *openapi3.RequestBody) map[string]bool {
	fields := map[string]bool{}

	for _, media := range body.Content {
		if media.Schema != nil {
			schemaFields(media.Schema.Value, fields)
		}
	}

	return fields
}

func schemaFields(s *openapi3.Schema, into map[string]bool) {
	if s == nil {
		return
	}

	for name := range s.Properties {
		into[name] = true
	}

	for _, ref := range s.AllOf {
		schemaFields(ref.Value, into)
	}
}

func collectProperties(s *jsonschema.Schema, into map[string]bool) {
	if s == nil {
		return
	}

	for name, p := range s.Properties {
		into[name] = true

		collectProperties(p, into)
	}

	collectProperties(s.Items, into)
}

var uncoveredFields = map[string][]string{
	"recordCorporateAction": {
		"cost_bp",
	}, // record_corporate_action reads it as cost_percent, a percent with two decimals (E-07)
	"importPrices": {
		"file",
	}, // import_price_file reads file_id, a file the member attached to the conversation (F7)
	"createAttachment": {
		"file",
	}, // attach_file reads file_id, a file the member attached to the conversation (F7)
	"importFile": {
		"file",
		"format",
	}, // import_statement_file reads file_id, and the format is the kind of the stored file (F7)
	"requestExport": {
		"credentials_passphrase",
	}, // a passphrase would enter a stored conversation; the owner types it on the screen
	"recordInstrumentPrices": {
		"dry_run",
	}, // the preview of record_price_series runs the dry run
	"saveContributionPlan": {
		"revision",
	}, // the member confirms the whole plan the tool shows, so it is not checked against a read (CO15)
	"saveBudgetBuckets": {
		"from",
	}, // the tool reads it as month
	"putInstrumentTerms": {
		"payments",
		"rate_steps",
		"rate_steps_apply",
	}, // manage_instrument set_terms leaves them out for its size; set_payment_schedule and
	// set_rate_steps write them (F-16, F-05)
	"createFixedIncomeApplication": {
		"application_id",
		"contract",
	}, // application_id is generated; the contract fields are flat tool inputs
	"addBudgetAmount": {
		"effective_from",
	}, // read as month
	"anticipateInstallments": {
		"target_statement",
	}, // read as statement
	"cancelInstallmentPlan": {
		"credit_statement",
	}, // read as statement
	"categorizeTransaction": {
		"expected_version",
		"parts",
	}, // expected_version is the version the preview read; parts: see change_transaction allocations
	"categorizeTransactions": {
		"items",
	}, // one category for the whole call; a call per category
	"changeScheduleTerms": {
		"effective_from",
		"recurrence",
	}, // effective_from is read as from; recurrence beyond frequency, interval and day_of_month is not offered
	"closeAccount": {
		"closed_on",
	}, // read as date
	"correctTransaction": {
		"expected_version",
		"links",
		"postings",
	}, // expected_version is the version the preview read; postings and links are not offered
	"correctTrade": {
		"expected_version",
		"trade",
	}, // expected_version is the version the preview read; the fields of trade are flat inputs
	"correctInvestmentIncome": {
		"expected_version",
		"income",
	}, // expected_version is the version the preview read; the fields of income are flat inputs
	"createBalanceAssertion": {
		"source",
	}, // the tool records source manual
	"createBudget": {
		"effective_from",
	}, // read as month
	"createGoal": {
		"allocated_account_ids",
		"target",
	}, // allocated_account_ids is read as account_ids with allocated; target as amount
	"createGoalAllocation": {
		"account_id",
		"booked_on",
	}, // account_id is read as account_ids; booked_on is today (planning coherence A255)
	"createInstallmentPurchase": {
		"card_account_id",
		"first_statement",
		"installment_amounts",
		"installment_count",
		"interest",
	}, // card_account_id is from_account_id and installment_count is installments; first_statement, installment_amounts and interest are not offered
	"createInstitution": {
		"code",
	}, // code is not offered; the identifier is read as scheme and identifier
	"createSchedule": {
		"calendar",
		"goal_id",
		"recurrence",
	}, // calendar is the region default; goal_id is set from the Goals screen (A255); recurrence beyond frequency, interval and day_of_month is not offered
	"createTransactionBatch": {
		"entries",
	}, // a call per transaction
	"createTransaction": {
		"links",
		"postings",
	}, // postings and links are not offered; from, to and splits cover the common cases
	"exchangeCurrency": {
		"from_amount",
	}, // read as amount
	"mapExternalAccount": {
		"ignored",
	}, // read as ignore
	"mergeAccount": {
		"into",
	}, // read as into_id
	"mergePayee": {
		"into",
	}, // read as into_id
	"mergeTag": {
		"into",
	}, // read as into_tag
	"openDispute": {
		"opened_on",
	}, // read as date
	"previewContributionPlan": {
		"classes",
	}, // the tool previews the saved plan
	"previewRule": {
		"actions",
		"conditions",
		"enabled",
		"name",
		"stop_processing",
	}, // explain_categorization previews a description rule only
	"reconcileStatement": {
		"amount_due",
	}, // read as amount
	"recordForeignPurchase": {
		"account_id",
		"category_id",
		"foreign_charge_category_id",
		"foreign_charge_rate_bp",
		"original",
		"rate",
		"statement",
	}, // read as original_amount, original_currency, exchange_rate and to_account_id; the foreign charge overrides are not offered
	"recordPrice": {
		"instrument",
		"quote_instrument",
		"value",
	}, // read as code and price
	"recordTrade": {
		"side",
	}, // side is read as kind
	"reimburseTransaction": {
		"expected_version",
	}, // expected_version is the version the preview read
	"resolveDispute": {
		"resolved_on",
	}, // read as date
	"resolveExternalRecords": {
		"items",
	}, // a call per record
	"saveBudgetPlan": {
		"fixed",
	}, // read as amount
	"setStatementFacts": {
		"total",
	}, // read as amount
	"transferTransaction": {
		"account_id",
		"expected_version",
		"pair_with",
	}, // read as to_account_id; pair_with is not offered
	"unlockAccount": {
		"from",
	}, // read as date
	"updateCurrentUser": {
		"birth_date",
		"display_name",
	}, // display_name and birth_date are not offered; update_profile sets the language
	"updateGoal": {
		"allocated_account_ids",
		"target",
	}, // allocated_account_ids is read as account_ids with allocated; target as amount
	"voidTransactions": {
		"items",
	}, // a call per transaction
}
