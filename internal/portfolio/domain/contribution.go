package domain

import (
	"cmp"
	"errors"
	"fmt"
	"math/big"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	maxPlanClasses   = 20
	maxClassNameLen  = 60
	fullTargetBP     = 10000
	driftKeyTemplate = "%02d"
)

var (
	ErrTargetSum          = errors.New("contribution targets do not add up to 10000")
	ErrMemberTargetSum    = errors.New("member targets do not add up to 10000")
	ErrClassNameDuplicate = errors.New("duplicate class name")
	ErrMemberDuplicate    = errors.New("duplicate member")
	ErrPlanInvalid        = errors.New("invalid contribution plan")
	ErrQuestionInvalid    = errors.New("invalid contribution question")
	ErrAnswersInvalid     = errors.New("invalid contribution answers")
)

// Plan is the target split of a book (CN1 to CN4); Amount is nil without a stored amount.
type Plan struct {
	Classes []PlanClass
	Amount  *money.Money
}

type PlanClass struct {
	Name     string
	TargetBP int
	// Questions are the investor's yes-or-no questions (CQ1); empty for a class without them.
	Questions []string
	// QuestionFacts names the fact of each question, "" for a question the investor answers
	// (FQ1); empty in a class without questions.
	QuestionFacts []string
	// QuestionLimits holds the limit of each question, "" without one (AC11); empty in a class
	// without questions.
	QuestionLimits []string
	Members        []PlanMember
	// Rules gather the securities of the class by their facts (GR1); empty for a class by members.
	Rules []PlanRule
}

// PlanMember names exactly one of AccountID and Instrument; TargetBP is nil without member targets.
type PlanMember struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	TargetBP   *int
	// Answers holds one answer per question of the class, true for "sim", nil for a question with
	// a fact the investor did not answer (CQ2); nil without questions.
	Answers []*bool
	// FactAnswers holds the answer of the filings to each question (FQ3); nil means every answer
	// is the investor's. FactsYear is the fiscal year they read (FQ6).
	FactAnswers []FactAnswer
	// FactDetails holds what each answer of FactAnswers read (AC14).
	FactDetails []FactDetail
	FactsYear   *time.Time
}

// Slot is one class or one member as the split reads it.
type Slot struct {
	TargetBP int
	Value    int64
}

// Check applies CN2 and CN4 and the uniqueness of CN3; ErrPlanInvalid covers a name outside 1 to 60
// characters, more than 20 classes, a target outside 0 to 10000, a member naming none or both, and
// an amount that is not positive.
func (p Plan) Check() error {
	if err := p.checkShape(); err != nil {
		return err
	}

	if err := p.checkClassNames(); err != nil {
		return err
	}

	if sumClassTargets(p.Classes) != fullTargetBP {
		return ErrTargetSum
	}

	for _, c := range p.Classes {
		if err := c.checkMemberTargets(); err != nil {
			return err
		}
	}

	return p.checkMemberUniqueness()
}

// Split returns the amount of each slot, in slot order, adding up to amount (CN7, CN9); amount >= 0.
// Without a slot of positive target the result is all zeros.
func Split(slots []Slot, amount int64) []int64 {
	out := make([]int64, len(slots))

	order := fundingOrder(slots)
	if amount <= 0 || len(order) == 0 {
		return out
	}

	level, funded := fundingLevel(slots, order, amount)
	fractions := make(map[int]*big.Rat, len(funded))

	var assigned int64
	for _, i := range funded {
		exact := new(big.Rat).Mul(level, big.NewRat(int64(slots[i].TargetBP), 1))
		exact.Sub(exact, big.NewRat(slots[i].Value, 1))

		floor := new(big.Int).Div(exact.Num(), exact.Denom())
		out[i] = floor.Int64()
		assigned += out[i]
		fractions[i] = exact.Sub(exact, new(big.Rat).SetInt(floor))
	}

	slices.SortFunc(funded, func(a, b int) int {
		return cmp.Or(fractions[b].Cmp(fractions[a]), cmp.Compare(a, b))
	})

	for _, i := range funded[:amount-assigned] {
		out[i]++
	}

	return out
}

// Drift returns sum |share - target| / 2 in basis points with the shares of Allocate keyed by
// fmt.Sprintf("%02d", i); ok is false when the total is not positive (CN15).
func Drift(slots []Slot) (bp int, ok bool) {
	holdings := make([]Holding, len(slots))
	for i, s := range slots {
		holdings[i] = Holding{Key: fmt.Sprintf(driftKeyTemplate, i), Value: s.Value}
	}

	shares := map[string]int{}
	total := 0

	for _, g := range Allocate(holdings) {
		shares[g.Key] = g.ShareBP
		total += g.ShareBP
	}

	if total == 0 {
		return 0, false
	}

	var sum int
	for i, s := range slots {
		sum += absInt(shares[fmt.Sprintf(driftKeyTemplate, i)] - s.TargetBP)
	}

	return sum / 2, true
}

func (p Plan) checkShape() error {
	if len(p.Classes) > maxPlanClasses {
		return fmt.Errorf("%w: %d classes", ErrPlanInvalid, len(p.Classes))
	}

	if p.Amount != nil && p.Amount.Amount() <= 0 {
		return fmt.Errorf("%w: amount is not positive", ErrPlanInvalid)
	}

	for _, c := range p.Classes {
		if err := c.checkShape(); err != nil {
			return err
		}
	}

	return nil
}

func (p Plan) checkClassNames() error {
	seen := map[string]bool{}

	for _, c := range p.Classes {
		name := strings.ToLower(c.Name)
		if seen[name] {
			return fmt.Errorf("%w: %q", ErrClassNameDuplicate, c.Name)
		}

		seen[name] = true
	}

	return nil
}

func (p Plan) checkMemberUniqueness() error {
	seen := map[string]bool{}

	for _, c := range p.Classes {
		for _, m := range c.Members {
			key := m.AccountID.String() + "/" + string(m.Instrument)
			if seen[key] {
				return fmt.Errorf("%w: class %q", ErrMemberDuplicate, c.Name)
			}

			seen[key] = true
		}
	}

	return nil
}

func (c PlanClass) checkShape() error {
	if n := utf8.RuneCountInString(c.Name); n < 1 || n > maxClassNameLen {
		return fmt.Errorf("%w: class name of %d characters", ErrPlanInvalid, n)
	}

	if c.TargetBP < 0 || c.TargetBP > fullTargetBP {
		return fmt.Errorf("%w: class %q target %d", ErrPlanInvalid, c.Name, c.TargetBP)
	}

	for _, m := range c.Members {
		if err := m.checkShape(); err != nil {
			return fmt.Errorf("class %q: %w", c.Name, err)
		}
	}

	return c.checkRules()
}

func (c PlanClass) checkMemberTargets() error {
	with := 0
	sum := 0

	for _, m := range c.Members {
		if m.TargetBP != nil {
			with++
			sum += *m.TargetBP
		}
	}

	if with == 0 {
		return nil
	}

	if with != len(c.Members) || sum != fullTargetBP {
		return fmt.Errorf("%w: class %q", ErrMemberTargetSum, c.Name)
	}

	return nil
}

func (m PlanMember) checkShape() error {
	if hasAccount, hasInstrument := m.AccountID != uuid.Nil, m.Instrument != ""; hasAccount == hasInstrument {
		return fmt.Errorf(
			"%w: a member names exactly one of account and instrument",
			ErrPlanInvalid,
		)
	}

	if m.TargetBP != nil && (*m.TargetBP < 0 || *m.TargetBP > fullTargetBP) {
		return fmt.Errorf("%w: member target %d", ErrPlanInvalid, *m.TargetBP)
	}

	return nil
}

func sumClassTargets(classes []PlanClass) int {
	sum := 0
	for _, c := range classes {
		sum += c.TargetBP
	}

	return sum
}

// fundingOrder lists the slots of positive target by increasing v/t, ties by position; the
// comparison cross-multiplies in big.Int because v * t can pass 64 bits.
func fundingOrder(slots []Slot) []int {
	var order []int

	for i, s := range slots {
		if s.TargetBP > 0 {
			order = append(order, i)
		}
	}

	slices.SortStableFunc(order, func(a, b int) int {
		left := new(big.Int).Mul(big.NewInt(slots[a].Value), big.NewInt(int64(slots[b].TargetBP)))
		right := new(big.Int).Mul(big.NewInt(slots[b].Value), big.NewInt(int64(slots[a].TargetBP)))

		return left.Cmp(right)
	})

	return order
}

// fundingLevel returns L = (amount + sum v) / sum t over the shortest prefix of order whose next
// slot already holds at least L per basis point of target, and that prefix.
func fundingLevel(slots []Slot, order []int, amount int64) (*big.Rat, []int) {
	sumV := big.NewInt(amount)
	sumT := new(big.Int)

	var level *big.Rat

	for k, i := range order {
		sumV.Add(sumV, big.NewInt(slots[i].Value))
		sumT.Add(sumT, big.NewInt(int64(slots[i].TargetBP)))
		level = new(big.Rat).SetFrac(sumV, sumT)

		if k == len(order)-1 {
			break
		}

		next := slots[order[k+1]]
		if level.Cmp(big.NewRat(next.Value, int64(next.TargetBP))) <= 0 {
			return level, slices.Clone(order[:k+1])
		}
	}

	return level, slices.Clone(order)
}

func absInt(v int) int {
	if v < 0 {
		return -v
	}

	return v
}
