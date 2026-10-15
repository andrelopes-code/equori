package domain

import (
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Class string

const (
	ClassAsset     Class = "asset"
	ClassLiability Class = "liability"
	ClassEquity    Class = "equity"
	ClassIncome    Class = "income"
	ClassExpense   Class = "expense"
)

type Kind string

const (
	KindChecking   Kind = "checking"
	KindSavings    Kind = "savings"
	KindCash       Kind = "cash"
	KindWallet     Kind = "wallet"
	KindBenefit    Kind = "benefit"
	KindReserve    Kind = "reserve"
	KindBrokerage  Kind = "brokerage"
	KindReceivable Kind = "receivable"
	KindCreditCard Kind = "credit_card"
	KindLoan       Kind = "loan"
	KindPayable    Kind = "payable"
)

// kindsByClass is the class/kind matrix of chapter 5, 5.2.2.
var kindsByClass = map[Class][]Kind{
	ClassAsset:     {KindChecking, KindSavings, KindCash, KindWallet, KindBenefit, KindReserve, KindBrokerage, KindReceivable, KindLoan},
	ClassLiability: {KindCreditCard, KindLoan, KindPayable},
	ClassEquity:    nil,
	ClassIncome:    nil,
	ClassExpense:   nil,
}

type YieldMode string

const (
	YieldNone YieldMode = "none"
	YieldAuto YieldMode = "auto"
)

type SystemRole string

const (
	RoleOpeningBalances      SystemRole = "opening_balances"
	RoleAdjustments          SystemRole = "adjustments"
	RoleUncategorizedExpense SystemRole = "uncategorized_expense"
	RoleUncategorizedIncome  SystemRole = "uncategorized_income"
	RoleYield                SystemRole = "yield"
	RoleDiscounts            SystemRole = "discounts"
	RoleInterest             SystemRole = "interest"
	RoleTaxes                SystemRole = "taxes"
	RoleFees                 SystemRole = "fees"
	RoleRealizedGains        SystemRole = "realized_gains"
	RoleRealizedLosses       SystemRole = "realized_losses"
)

var systemRoles = []struct {
	role  SystemRole
	class Class
	name  string
}{
	{RoleOpeningBalances, ClassEquity, "Opening balances"},
	{RoleAdjustments, ClassEquity, "Adjustments"},
	{RoleUncategorizedExpense, ClassExpense, "Uncategorized expense"},
	{RoleInterest, ClassExpense, "Interest"},
	{RoleTaxes, ClassExpense, "Taxes"},
	{RoleFees, ClassExpense, "Fees"},
	{RoleRealizedLosses, ClassExpense, "Realized losses"},
	{RoleUncategorizedIncome, ClassIncome, "Uncategorized income"},
	{RoleYield, ClassIncome, "Yield"},
	{RoleDiscounts, ClassIncome, "Discounts"},
	{RoleRealizedGains, ClassIncome, "Realized gains"},
}

func SystemRoles() []SystemRole {
	out := make([]SystemRole, len(systemRoles))
	for i, r := range systemRoles {
		out[i] = r.role
	}
	return out
}

func (r SystemRole) Class() Class {
	for _, s := range systemRoles {
		if s.role == r {
			return s.class
		}
	}
	return ""
}

// DefaultName is the name given to the system account when the user is provisioned.
func (r SystemRole) DefaultName() string {
	for _, s := range systemRoles {
		if s.role == r {
			return s.name
		}
	}
	return ""
}

type Account struct {
	ID             uuid.UUID
	UserID         int64
	Name           string
	Class          Class
	Kind           Kind
	Instrument     money.Currency
	ParentID       uuid.UUID
	InstitutionID  uuid.UUID
	CounterpartyID uuid.UUID
	OpenedOn       time.Time
	ClosedOn       *time.Time
	YieldMode      YieldMode
	SystemRole     SystemRole
}

const maxNameLength = 120

func NewAccount(a Account) (Account, error) {
	a.Name = strings.TrimSpace(a.Name)
	if n := utf8.RuneCountInString(a.Name); n == 0 || n > maxNameLength {
		return Account{}, invalid("name", "must have 1 to 120 characters")
	}
	kinds, ok := kindsByClass[a.Class]
	if !ok {
		return Account{}, invalid("class", "must be asset, liability, equity, income or expense")
	}
	switch {
	case a.IsBalance() && a.Kind == "":
		return Account{}, invalid("kind", "is required for asset and liability accounts")
	case !a.IsBalance() && a.Kind != "":
		return Account{}, invalid("kind", "is only allowed on asset and liability accounts")
	case a.IsBalance() && !slices.Contains(kinds, a.Kind):
		return Account{}, invalid("kind", "is not allowed for class "+string(a.Class))
	}
	if _, err := money.ParseCurrency(string(a.Instrument)); err != nil {
		return Account{}, invalid("instrument", "must be a supported currency")
	}
	if a.OpenedOn.IsZero() {
		return Account{}, invalid("opened_on", "is required")
	}
	if a.ClosedOn != nil && a.ClosedOn.Before(a.OpenedOn) {
		return Account{}, invalid("closed_on", "must not be before opened_on")
	}
	switch a.YieldMode {
	case "":
		a.YieldMode = YieldNone
		if a.Kind == KindReserve {
			a.YieldMode = YieldAuto
		}
	case YieldNone, YieldAuto:
	default:
		return Account{}, invalid("yield_mode", "must be none or auto")
	}
	if a.SystemRole != "" && a.SystemRole.Class() != a.Class {
		return Account{}, invalid("system_role", "does not match the account class")
	}
	return a, nil
}

// IsBalance reports whether the account holds money the user has or owes (chapter 2).
func (a Account) IsBalance() bool { return a.Class == ClassAsset || a.Class == ClassLiability }

// IsOpenOn includes both the opening and the closing date.
func (a Account) IsOpenOn(d time.Time) bool {
	return !d.Before(a.OpenedOn) && (a.ClosedOn == nil || !d.After(*a.ClosedOn))
}

func ValidateParent(child, parent Account) error {
	switch {
	case child.ID == parent.ID:
		return invalid("parent_id", "must differ from the account")
	case child.UserID != parent.UserID:
		return &FieldError{Field: "parent_id", Message: "unknown account", Err: ErrUnknownAccount}
	case child.Class != parent.Class:
		return invalid("parent_id", "must have the same class")
	case child.Instrument != parent.Instrument:
		return invalid("parent_id", "must use the same currency, so the parent balance is a sum of one currency")
	case child.IsBalance() && child.InstitutionID != parent.InstitutionID:
		return invalid("parent_id", "must be at the same institution")
	}
	return nil
}
