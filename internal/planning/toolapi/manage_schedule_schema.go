package toolapi

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageScheduleAction string

func (manageScheduleAction) Values() []string {
	return []string{"create", "update", "change_terms", "pause", "end"}
}

type manageScheduleKind string

func (manageScheduleKind) Values() []string {
	return []string{"bill", "income", "subscription", "transfer", "savings"}
}

type manageScheduleFrequency string

func (manageScheduleFrequency) Values() []string {
	return []string{"daily", "weekly", "monthly", "yearly"}
}

type manageScheduleIn struct {
	Action        manageScheduleAction    `json:"action"                  jsonschema:"operation to propose"`
	ScheduleID    string                  `json:"schedule_id,omitzero"    jsonschema:"for update, change_terms, pause and end: schedule from list_schedules"`
	Kind          manageScheduleKind      `json:"kind,omitzero"           jsonschema:"for create: kind of schedule"`
	Description   string                  `json:"description,omitzero"    jsonschema:"for create: description of each transaction; for update: new description of the schedule"`
	AccountID     string                  `json:"account_id,omitzero"     jsonschema:"for create: balance account the money leaves or reaches"`
	CounterpartID string                  `json:"counterpart_id,omitzero" jsonschema:"for create: category, or the other account of a transfer"`
	PayeeID       string                  `json:"payee_id,omitzero"       jsonschema:"for create: payee from list_payees_and_tags"`
	Amount        string                  `json:"amount,omitzero"         jsonschema:"for create and change_terms: positive amount of each occurrence"`
	Frequency     manageScheduleFrequency `json:"frequency,omitzero"      jsonschema:"for create and change_terms: repetition unit"`
	Interval      int                     `json:"interval,omitzero"       jsonschema:"for create and change_terms: repeat every this many units; 1 when absent"`
	DayOfMonth    int                     `json:"day_of_month,omitzero"   jsonschema:"for monthly schedules: day of the month"`
	Start         tool.Date               `json:"start,omitzero"          jsonschema:"for create: date of the first occurrence"`
	Until         tool.Date               `json:"until,omitzero"          jsonschema:"for create: last possible date; absent for no end"`
	From          tool.Date               `json:"from,omitzero"           jsonschema:"for change_terms: first date the new terms apply; for pause: first paused date; for end: first date without occurrences"`
	To            tool.Date               `json:"to,omitzero"             jsonschema:"for pause: last paused date"`

	PaidByTransactionID string `json:"paid_by_transaction_id,omitzero" jsonschema:"for create: the transaction that paid the occurrence on start"`

	StartsOn         tool.Date        `json:"starts_on,omitzero"          jsonschema:"for update: earlier first date, on the rhythm of the schedule"`
	MatchToleranceBP tool.OptionalInt `json:"match_tolerance_bp,omitzero" jsonschema:"for create and update: amount tolerance in basis points, 0 to 10000; 1000 when absent"`
	GraceDays        tool.OptionalInt `json:"grace_days,omitzero"         jsonschema:"for create and update: days past the expected date before overdue; 3 when absent"`
	MatchWindowDays  tool.OptionalInt `json:"match_window_days,omitzero"  jsonschema:"for create and update: days from the expected date a transaction may realize it, 0 to 31; 7 when absent"`
}

// schedulePlan holds what a manage_schedule call reads and validates before it previews or writes.
type schedulePlan struct {
	schedule             domain.Schedule // the schedule changed; zero for create
	account, counterpart Account
	accountID, counterID uuid.UUID
	payeeID              uuid.UUID
	amount               *money.Money
	rule                 *domain.Rule
	paidBy               uuid.UUID
	paidByFact           Transaction
}
