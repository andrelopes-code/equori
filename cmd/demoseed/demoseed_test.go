package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const testToday = "2026-11-05"

func seedHarness(t *testing.T, date string) (*seeder, config, *apitest.Harness) {
	t.Helper()
	h := apitest.New(t, apitest.Today(date))
	c := h.LoginAs("demo@equori.local", locale.Locale{Language: "pt", Region: "BR"}, "BRL")

	today, err := time.Parse(time.DateOnly, date)
	if err != nil {
		t.Fatal(err)
	}

	return newSeeder(context.Background(), h.URL(), c), config{today: today}, h
}

func TestSeed(t *testing.T) {
	s, cfg, h := seedHarness(t, testToday)
	if err := seed(s, cfg); err != nil {
		t.Fatal(err)
	}

	t.Logf("requests: %d", s.calls)
	h.Dispatch()

	t.Run("opening balances", func(t *testing.T) {
		for _, a := range accounts {
			if a.opening == 0 {
				continue
			}

			// Spending on the first day of the history moves the balance of that day.
			got := s.balanceOn(a.key, iso(s.start))
			for _, e := range s.entries {
				if e.account == s.id(a.key) && e.date == iso(s.start) && !strings.HasPrefix(e.desc, "Saldo inicial") {
					got -= e.cents
				}
			}

			if got != a.opening {
				t.Errorf("opening balance of %s = %d, want %d", a.key, got, a.opening)
			}
		}

		if s.err != nil {
			t.Fatal(s.err)
		}
	})

	t.Run("chart", func(t *testing.T) {
		if got := len(s.listAccounts()); got < 90 {
			t.Errorf("accounts and categories = %d, want at least 90", got)
		}
	})

	t.Run("no overdrawn balance account", func(t *testing.T) {
		for _, key := range []string{"itau.checking", "nubank.checking", "itau.savings", "wallet", "alelo.meal"} {
			got := s.balanceOn(key, testToday)
			t.Logf("%s balance on %s = %d", key, testToday, got)

			if got < 0 {
				t.Errorf("%s balance on %s = %d, want at least 0", key, testToday, got)
			}
		}
	})

	t.Run("cash accounts", func(t *testing.T) {
		// Each account is checked against the range its use gives it on the last day of the history.
		for _, c := range []struct {
			key      string
			min, max int64
		}{
			{"itau.savings", 1237500, 1400000},   // the savings book yields about 0.65 % a month on R$ 11.250,00.
			{"nubank.reserve", 3300000, 4000000}, // R$ 21.300,00 at the start, R$ 300,00 a month and about 1 % a month.
			{"nubank.checking", 0, 600000},       // the Pix of payday brings it to R$ 4.500,00 and the month spends it.
			{"alelo.meal", 0, 250000},            // the meal card is spent in the month it is credited.
			{"xp.cash", 0, 600000},               // the monthly contribution is invested.
		} {
			got := s.balanceOn(c.key, testToday)
			t.Logf("%s balance on %s = %d", c.key, testToday, got)

			if got < c.min || got > c.max {
				t.Errorf("%s balance on %s = %d, want %d to %d", c.key, testToday, got, c.min, c.max)
			}
		}
	})

	t.Run("checking accounts never close a day overdrawn", func(t *testing.T) {
		daily := map[string]map[string]int64{"itau.checking": {}, "nubank.checking": {}}

		for _, tx := range s.transactions(t) {
			for _, p := range tx.Postings {
				for key, byDay := range daily {
					if p.AccountID == s.id(key) {
						byDay[tx.Date] += p.Amount.Amount
					}
				}
			}
		}

		for key, byDay := range daily {
			days := make([]string, 0, len(byDay))
			for d := range byDay {
				days = append(days, d)
			}

			slices.Sort(days)

			var balance int64

			for _, d := range days {
				balance += byDay[d]
				if balance < 0 {
					t.Errorf("%s closes %s with %d cents", key, d, balance)
				}
			}
		}
	})

	t.Run("savings rate", func(t *testing.T) {
		var out struct {
			Months []struct {
				Income  money `json:"income"`
				Expense money `json:"expense"`
			} `json:"months"`
		}
		s.do(http.MethodGet, "/reports/indicators?month=2026-10", nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		var income, expense int64
		for _, m := range out.Months {
			income += m.Income.Amount
			expense += m.Expense.Amount
		}

		// The persona saves 15 to 20 % of the income (docs/plans/2026-10-24-demo-account.md).
		rate := float64(income-expense) / float64(income) * 100
		t.Logf("savings rate of the last 12 months: %.1f %%", rate)

		if rate < 14 || rate > 22 {
			t.Errorf("savings rate of the last 12 months = %.1f %%, want 14 to 22 %%", rate)
		}
	})

	t.Run("monthly spending varies", func(t *testing.T) {
		var expenses []float64

		for _, month := range []string{"2025-10", "2026-10"} {
			var out struct {
				Months []struct {
					Month   string `json:"month"`
					Expense struct {
						Amount int64 `json:"amount"`
					} `json:"expense"`
				} `json:"months"`
			}
			s.do(http.MethodGet, "/reports/indicators?month="+month, nil, &out)

			for _, m := range out.Months {
				expenses = append(expenses, float64(m.Expense.Amount))
			}
		}

		if s.err != nil {
			t.Fatal(s.err)
		}

		slices.Sort(expenses)

		// The cheapest months, without the first month of the history, are the ordinary ones: they do not repeat the same total.
		ordinary := expenses[1:11]
		spread := (ordinary[len(ordinary)-1] - ordinary[0]) / ordinary[0]
		t.Logf("monthly expenses: %.0f; the ten cheapest after the first span %.1f %%", expenses, spread*100)

		if spread < .08 {
			t.Errorf("the ordinary months span %.1f %% of the cheapest, want at least 8 %%", spread*100)
		}
	})

	t.Run("savings target and receipts", func(t *testing.T) {
		var plan struct {
			SavingsTargetBP int `json:"savings_target_bp"`
		}
		s.do(http.MethodGet, "/budget-plan?month=2026-11", nil, &plan)

		if plan.SavingsTargetBP != 2000 {
			t.Errorf("savings target of 2026-11 = %d bp, want 2000", plan.SavingsTargetBP)
		}

		// The invoices and tickets of the large purchases are attached to them.
		want := map[string]bool{
			"MacBook Air 13 polegadas": false, "Sofá de três lugares": false,
			"Passagens São Paulo para Lisboa (ida e volta)": false, "Compra não reconhecida, Mercado Livre": false,
		}

		for _, tx := range s.transactions(t) {
			if _, ok := want[tx.Description]; !ok {
				continue
			}

			var files struct {
				Items []json.RawMessage `json:"items"`
			}
			s.do(http.MethodGet, "/transactions/"+tx.ID+"/attachments", nil, &files)

			want[tx.Description] = len(files.Items) > 0
		}

		if s.err != nil {
			t.Fatal(s.err)
		}

		for description, attached := range want {
			if !attached {
				t.Errorf("%q has no attachment", description)
			}
		}
	})

	t.Run("fixed income terms use a published index", func(t *testing.T) {
		// The instance stores the rates of cdi and ipca only (S157); a term on another index cannot accrue.
		for _, sec := range securities {
			if sec.typ != "fixed_income" {
				continue
			}

			if index := sec.terms["index_id"]; index != "cdi" && index != "ipca" {
				t.Errorf("%s accrues on %v, want cdi or ipca", sec.code, index)
			}
		}
	})

	t.Run("reimbursements and rule suggestions", func(t *testing.T) {
		// Rafael repays half of some dinners as a reimbursement of the expense, and two corrections of one payee suggest a rule.
		var out struct {
			Items []struct {
				Examples []string `json:"examples"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/rule-suggestions?state=pending", nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		if len(out.Items) < 2 {
			t.Errorf("pending rule suggestions = %d, want at least 2", len(out.Items))
		}

		repaid := 0

		for _, tx := range s.transactions(t) {
			if tx.Description != "Rafael devolveu a parte do jantar" {
				continue
			}

			if len(tx.Links) > 0 {
				repaid++
			}
		}

		if repaid < 8 {
			t.Errorf("dinners repaid as a reimbursement = %d, want at least 8", repaid)
		}
	})

	t.Run("pay days skip the holidays", func(t *testing.T) {
		// Good Friday 2026-04-03 is not a business day: the fifth business day of April 2026 is the 8th, as the schedule expects.
		found := false

		for _, tx := range s.transactions(t) {
			if tx.Description == "Salário 2026-04" {
				found = true

				if tx.Date != "2026-04-08" {
					t.Errorf("salary of 2026-04 on %s, want 2026-04-08", tx.Date)
				}
			}
		}

		if !found {
			t.Error("no salary of 2026-04")
		}
	})

	t.Run("budgets carry over a few months at most", func(t *testing.T) {
		var list struct {
			Items []struct {
				ID       string `json:"id"`
				Rollover bool   `json:"rollover"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/budgets", nil, &list)

		// A rollover budget that spends half of its amount for two years would show a carry of many months.
		for _, b := range list.Items {
			var progress struct {
				Planned money `json:"planned"`
				Carried money `json:"carried"`
			}
			s.do(http.MethodGet, "/budgets/"+b.ID+"/progress?month=2026-10", nil, &progress)

			if b.Rollover && progress.Carried.Amount > progress.Planned.Amount*4 {
				t.Errorf("budget %s carries %d over %d planned, want at most four months", b.ID, progress.Carried.Amount, progress.Planned.Amount)
			}
		}

		if s.err != nil {
			t.Fatal(s.err)
		}
	})

	t.Run("the open difference is the one set on purpose", func(t *testing.T) {
		// The institution shows a Pix of R$ 38,40 that the ledger lacks; imports and fundings made after the assertion must not move it.
		var out struct {
			OpenDifference struct {
				Difference money `json:"difference"`
			} `json:"open_difference"`
		}
		s.do(http.MethodGet, "/accounts/"+s.id("itau.checking")+"/reconciliation", nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		if got := out.OpenDifference.Difference.Amount; got != 3840 {
			t.Errorf("open difference of the salary account = %d, want 3840", got)
		}
	})

	t.Run("every payee and category is used", func(t *testing.T) {
		var payees struct {
			Items []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/payees?limit=200", nil, &payees)

		var accs struct {
			Items []struct {
				ID         string `json:"id"`
				Name       string `json:"name"`
				Class      string `json:"class"`
				ParentID   string `json:"parent_id"`
				SystemRole string `json:"system_role"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/accounts?limit=200", nil, &accs)

		if s.err != nil {
			t.Fatal(s.err)
		}

		usedPayee, usedAccount, parents := map[string]bool{}, map[string]bool{}, map[string]bool{}

		for _, tx := range s.transactions(t) {
			for _, p := range tx.Postings {
				usedAccount[p.AccountID] = true
			}

			usedPayee[tx.PayeeID] = true
		}

		for _, a := range accs.Items {
			parents[a.ParentID] = true
		}

		for _, p := range payees.Items {
			if !usedPayee[p.ID] {
				t.Errorf("payee %q has no transaction", p.Name)
			}
		}

		for _, a := range accs.Items {
			if (a.Class == "expense" || a.Class == "income") && a.SystemRole == "" && !parents[a.ID] && !usedAccount[a.ID] {
				t.Errorf("category %q has no transaction", a.Name)
			}
		}
	})

	t.Run("goals are under way", func(t *testing.T) {
		var out struct {
			Items []struct {
				Name    string `json:"name"`
				Target  money  `json:"target"`
				Current money  `json:"current"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/goals", nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		// A goal that is met long before its due date, or hardly started, does not read as followed.
		for _, g := range out.Items {
			share := float64(g.Current.Amount) / float64(g.Target.Amount) * 100
			t.Logf("goal %q: %.0f %% of the target", g.Name, share)

			if share < 30 || share > 90 {
				t.Errorf("goal %q holds %.0f %% of its target, want 30 to 90 %%", g.Name, share)
			}
		}
	})

	t.Run("bank feed", func(t *testing.T) {
		// Part of the last year comes from the statement files of the institutions, with the descriptor the institution prints.
		months := map[string]bool{}
		raw, imported := 0, 0

		for _, tx := range s.transactions(t) {
			if tx.Origin != "import" || tx.Date >= "2026-10-15" {
				continue
			}

			imported++
			months[tx.Date[:7]] = true

			if tx.Description == strings.ToUpper(tx.Description) || strings.HasPrefix(tx.Description, "Compra no debito ") {
				raw++
			}
		}

		t.Logf("imported before 2026-10-15: %d in %d months, %d with a raw descriptor", imported, len(months), raw)

		if imported < 150 {
			t.Errorf("imported transactions before 2026-10-15 = %d, want at least 150", imported)
		}

		if len(months) < 10 {
			t.Errorf("imported transactions cover %d months, want at least 10", len(months))
		}

		if raw*100 < imported*95 {
			t.Errorf("%d of %d imported descriptions are institution descriptors, want at least 95 %%", raw, imported)
		}
	})

	t.Run("habits follow the week", func(t *testing.T) {
		// Rides go to work and the groceries go home on the weekend; a day drawn at random would give 71 % and 29 %.
		var rides, weekdayRides, groceries, weekendGroceries, fairs int

		for _, tx := range s.transactions(t) {
			day, err := time.Parse(time.DateOnly, tx.Date)
			if err != nil {
				t.Fatal(err)
			}

			weekend := day.Weekday() == time.Saturday || day.Weekday() == time.Sunday

			switch {
			case strings.HasPrefix(tx.Description, "Feira de sábado"):
				fairs++

				if day.Weekday() != time.Saturday {
					t.Errorf("%q on %s, a %s", tx.Description, tx.Date, day.Weekday())
				}
			case strings.HasPrefix(tx.Description, "Corrida "):
				rides++

				if !weekend {
					weekdayRides++
				}
			case strings.HasPrefix(tx.Description, "Compras no "):
				groceries++

				if weekend {
					weekendGroceries++
				}
			}
		}

		if fairs == 0 {
			t.Error("no street fair purchase")
		}

		if weekdayRides*100 < rides*85 {
			t.Errorf("%d of %d rides on a weekday, want at least 85 %%", weekdayRides, rides)
		}

		if weekendGroceries*100 < groceries*40 {
			t.Errorf("%d of %d grocery purchases on a weekend, want at least 40 %%", weekendGroceries, groceries)
		}
	})

	t.Run("every due statement is paid", func(t *testing.T) {
		for _, card := range []string{"card.itau", "card.nubank"} {
			var out struct {
				Items []statementRow `json:"items"`
			}
			s.do(http.MethodGet, "/accounts/"+s.id(card)+"/statements?limit=100", nil, &out)

			if s.err != nil {
				t.Fatal(s.err)
			}

			if len(out.Items) < 24 {
				t.Errorf("%s has %d statements, want at least 24", card, len(out.Items))
			}

			for _, st := range out.Items {
				if st.DueDate < "2026-11-04" && st.Unpaid.Amount != 0 {
					t.Errorf("%s statement due %s is unpaid by %d", card, st.DueDate, st.Unpaid.Amount)
				}
			}
		}
	})

	t.Run("investments", func(t *testing.T) {
		// Positions of the second brokerage appear only after a rebuild, as make demo runs it.
		if err := h.App.Portfolio.RebuildAll(t.Context()); err != nil {
			t.Fatal(err)
		}

		for path, want := range map[string]int{"/positions?date=" + testToday: 12, "/realized-results?year=2026": 2, "/realized-results?year=2025": 1, "/goals": 3} {
			var out struct {
				Items []json.RawMessage `json:"items"`
			}
			s.do(http.MethodGet, path, nil, &out)

			if s.err != nil {
				t.Fatal(s.err)
			}

			if len(out.Items) < want {
				t.Errorf("%s returned %d items, want at least %d", path, len(out.Items), want)
			}
		}
	})

	t.Run("planning", func(t *testing.T) {
		var occ struct {
			Items []struct {
				State string `json:"state"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?from=2026-01-01&to=2026-06-30", nil, &occ)
		var budgets struct {
			Items []json.RawMessage `json:"items"`
		}
		s.do(http.MethodGet, "/budgets", nil, &budgets)

		if s.err != nil {
			t.Fatal(s.err)
		}

		states := map[string]int{}
		for _, o := range occ.Items {
			states[o.State]++
		}

		t.Logf("occurrences 2026-H1 by state: %v", states)

		// A schedule with a month of history shows that month paid, not skipped.
		if states["realized"] < 100 {
			t.Errorf("realized occurrences in 2026-H1 = %d, want at least 100", states["realized"])
		}

		// No bill of the past stays unpaid: every recorded charge fits its occurrence.
		for _, w := range [][2]string{{"2024-11-01", "2025-10-31"}, {"2025-11-01", "2026-10-31"}, {"2026-11-01", "2026-11-04"}} {
			var past struct {
				Items []struct {
					ScheduleID string `json:"schedule_id"`
					ExpectedOn string `json:"expected_on"`
				} `json:"items"`
			}
			s.do(http.MethodGet, "/occurrences?state=overdue&from="+w[0]+"&to="+w[1], nil, &past)

			for _, o := range past.Items {
				t.Errorf("occurrence of %s on %s is overdue, want realized", s.keyOf(o.ScheduleID), o.ExpectedOn)
			}
		}

		if s.err != nil {
			t.Fatal(s.err)
		}

		if len(budgets.Items) != len(budgetSpecs) {
			t.Errorf("budgets = %d, want %d", len(budgets.Items), len(budgetSpecs))
		}

		// Occurrences before the schedules existed are closed as skipped; the owner sees the upcoming ones as pending.
		var next struct {
			Items []struct {
				State string `json:"state"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?from=2026-11-06&to=2026-12-31", nil, &next)

		if len(next.Items) < 30 {
			t.Errorf("upcoming occurrences = %d, want at least 30", len(next.Items))
		}
	})

	t.Run("the last month of occurrences expects the current price", func(t *testing.T) {
		// The occurrences of the last 31 days are generated with the terms in force, so a received bill equals its expected amount.
		var out struct {
			Items []struct {
				ExpectedAmount money  `json:"expected_amount"`
				ActualAmount   *money `json:"actual_amount"`
				ExpectedOn     string `json:"expected_on"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?state=realized&schedule_id="+s.id("schedule.pet")+"&from=2026-10-06&to="+testToday, nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		if len(out.Items) == 0 {
			t.Fatal("no realized occurrence of the pet subscription in the last month")
		}

		for _, o := range out.Items {
			if o.ActualAmount == nil || o.ActualAmount.Amount != o.ExpectedAmount.Amount {
				t.Errorf("pet subscription on %s: expected %d, received %v", o.ExpectedOn, o.ExpectedAmount.Amount, o.ActualAmount)
			}
		}
	})

	t.Run("a schedule that lags its bill", func(t *testing.T) {
		// The gym raised its fee in 2025-09 and the schedule still expects the old one: the schedule page suggests the new amount.
		var sch struct {
			Terms []struct {
				EffectiveFrom string `json:"effective_from"`
				Amount        money  `json:"amount"`
			} `json:"terms"`
		}
		s.do(http.MethodGet, "/schedules/"+s.id("schedule.gym"), nil, &sch)

		var out struct {
			Items []struct {
				ActualAmount *money `json:"actual_amount"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?state=realized&schedule_id="+s.id("schedule.gym")+"&from=2026-08-01&to=2026-11-05", nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		if len(out.Items) < 3 {
			t.Fatalf("realized gym occurrences from 2026-08 = %d, want at least 3", len(out.Items))
		}

		current := sch.Terms[len(sch.Terms)-1].Amount.Amount
		for _, o := range out.Items {
			if o.ActualAmount == nil || o.ActualAmount.Amount*100 < current*101 {
				t.Errorf("gym occurrence: actual %v, current term %d, want an actual at least 1 %% above", o.ActualAmount, current)
			}
		}
	})

	t.Run("classification", func(t *testing.T) {
		if err := s.runRules(); err != nil {
			t.Fatal(err)
		}

		var out struct {
			Items []struct {
				Description string `json:"description"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/transactions?uncategorized=true", nil, &out)

		if s.err != nil {
			t.Fatal(s.err)
		}

		if len(out.Items) < 3 || len(out.Items) > 6 {
			t.Errorf("uncategorized transactions after the rules = %d, want 3 to 6", len(out.Items))
		}

		for _, it := range out.Items {
			t.Logf("uncategorized: %s", it.Description)
		}
	})

	t.Run("refuses a populated user", func(t *testing.T) {
		again := newSeeder(s.ctx, s.base, s.http)
		if err := seed(again, cfg); err == nil {
			t.Fatal("second seed succeeded, want a refusal")
		}
	})
}

// TestRulesMatchDescriptorsByWord checks the rule table: in_list compares the whole description with each value, so a rule that must match a word inside a descriptor uses a regular expression.
func TestRulesMatchDescriptorsByWord(t *testing.T) {
	for _, r := range rules {
		for _, c := range r.conditions {
			if c["field"] == "description" && c["operator"] == "in_list" {
				t.Errorf("rule %q compares the whole description with a list; use a regex over the words", r.name)
			}

			// The engine runs a regex on the description as the institution prints it, in capitals.
			if c["operator"] != "regex" {
				continue
			}

			pattern, _ := c["value"].(string)

			re, err := regexp.Compile(pattern)
			if err != nil {
				t.Errorf("rule %q: %v", r.name, err)
				continue
			}

			for _, word := range strings.Split(strings.TrimSuffix(strings.TrimPrefix(pattern, "(?i)("), ")"), "|") {
				if !re.MatchString(strings.ToUpper(word) + " 0442 SAO PAULO") {
					t.Errorf("rule %q does not match %q in capitals", r.name, word)
				}
			}
		}
	}
}

// TestEveryRuleCanFire checks that each rule matches a line that arrives through a statement file: a rule for a bill that the book records by hand would never categorize anything.
func TestEveryRuleCanFire(t *testing.T) {
	lines := []string{"Pix enviado Padaria Bella Paulista", "UBER *EATS"}
	for _, l := range itauExtraLines {
		lines = append(lines, l.name)
	}

	for _, d := range descriptors {
		lines = append(lines, d, "Compra no debito "+d)
	}

	for _, r := range rules {
		fires := false

		for _, line := range lines {
			holds := true

			for _, c := range r.conditions {
				if c["field"] != "description" {
					continue
				}

				value, _ := c["value"].(string)

				switch c["operator"] {
				case "contains":
					holds = holds && strings.Contains(strings.ToLower(line), value)
				case "regex":
					holds = holds && regexp.MustCompile(value).MatchString(line)
				default:
					holds = false
				}
			}

			fires = fires || holds
		}

		if !fires {
			t.Errorf("rule %q matches no statement line of the seed", r.name)
		}
	}
}

// TestSeedFollowsToday seeds a date other than the default: the lines of the statements of the last three weeks fall in the three weeks before it.
func TestSeedFollowsToday(t *testing.T) {
	const date = "2026-12-19"

	s, cfg, _ := seedHarness(t, date)
	if err := seed(s, cfg); err != nil {
		t.Fatal(err)
	}

	found := 0

	for _, tx := range s.transactions(t) {
		if tx.Description != "KABUM*PEDIDO 9918" && tx.Description != "Pix enviado Joana S" {
			continue
		}

		found++

		if tx.Date < "2026-11-28" || tx.Date > date {
			t.Errorf("%s dated %s, want a date from 2026-11-28 to %s", tx.Description, tx.Date, date)
		}
	}

	if found != 2 {
		t.Errorf("lines of the last statements found = %d, want 2", found)
	}
}

type transactionRow struct {
	ID          string            `json:"id"`
	Date        string            `json:"date"`
	Origin      string            `json:"origin"`
	Description string            `json:"description"`
	PayeeID     string            `json:"payee_id"`
	Links       []json.RawMessage `json:"links"`
	Postings    []struct {
		AccountID string `json:"account_id"`
		Amount    money  `json:"amount"`
	} `json:"postings"`
}

// transactions lists every transaction of the book.
func (s *seeder) transactions(t *testing.T) []transactionRow {
	t.Helper()

	var all []transactionRow

	cursor := ""
	for {
		var page struct {
			Items      []transactionRow `json:"items"`
			NextCursor string           `json:"next_cursor"`
		}

		path := "/transactions?limit=200"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}

		s.do(http.MethodGet, path, nil, &page)

		if s.err != nil {
			t.Fatal(s.err)
		}

		all = append(all, page.Items...)

		if cursor = page.NextCursor; cursor == "" {
			return all
		}
	}
}

func (s *seeder) keyOf(id string) string {
	for k, v := range s.ids {
		if v == id {
			return k
		}
	}

	return id
}
