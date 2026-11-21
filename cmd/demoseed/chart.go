package main

import "net/http"

func (s *seeder) localizeSystemAccounts() {
	for _, n := range systemNames {
		id := s.id("system." + n.role)
		s.do(http.MethodPatch, "/accounts/"+id, map[string]any{"name": n.name}, nil)
		s.do(
			http.MethodPut,
			"/accounts/"+id+"/appearance",
			map[string]any{"color": n.color, "icon": nil},
			nil,
		)
	}
}

func (s *seeder) buildChart(start string) {
	s.buildInstitutions()
	s.buildAccounts(start)
	s.buildCards(start)
	s.buildCategoryTrees()
}

func (s *seeder) buildInstitutions() {
	for _, in := range institutions {
		body := map[string]any{"name": in.name}
		if in.scheme != "" {
			body["identifier"] = map[string]any{"scheme": in.scheme, "identifier": in.identifier}
		}

		s.ids["inst."+in.key] = s.create("/institutions", body)
	}
}

func (s *seeder) buildAccounts(start string) {
	for _, a := range accounts {
		body := map[string]any{
			"name":      a.name,
			"class":     a.class,
			"kind":      a.kind,
			"currency":  "BRL",
			"opened_on": start,
			"color":     a.color,
		}
		if a.currency != "" {
			body["currency"] = a.currency
		}

		if a.opened != "" {
			body["opened_on"] = a.opened
		}

		// The brokerage holds ten years of investments.
		if a.institution == "xp" {
			body["opened_on"] = iso(s.investStart())
		}

		if a.institution != "" {
			body["institution_id"] = s.id("inst." + a.institution)
		}

		if a.parent != "" {
			body["parent_id"] = s.id(a.parent)
		}

		if a.yield {
			body["yield_mode"] = "auto"
		}

		s.ids[a.key] = s.create("/accounts", body)
	}
}

func (s *seeder) buildCards(start string) {
	for _, c := range cards {
		s.ids[c.key] = s.create("/accounts", map[string]any{
			"name": c.name, "class": "liability", "kind": "credit_card", "currency": "BRL",
			"institution_id": s.id("inst." + c.institution), "opened_on": start, "color": c.color,
		})
		for _, p := range c.plastics {
			s.create(
				"/accounts/"+s.id(c.key)+"/cards",
				map[string]any{
					"holder":    "MARIANA C RIBEIRO",
					"last_four": p.lastFour,
					"virtual":   p.virtual,
				},
			)
		}

		for i, r := range c.rules {
			if i == 0 {
				r["effective_from"] = start[:7]
			}

			s.do(http.MethodPost, "/accounts/"+s.id(c.key)+"/billing-cycle-rules", r, nil)
		}

		for i, l := range c.limits {
			if i == 0 {
				l["effective_from"] = start
			}

			s.do(http.MethodPost, "/accounts/"+s.id(c.key)+"/credit-limits", l, nil)
		}
	}
}

func (s *seeder) buildCategoryTrees() {
	s.addCategories("expense", "", 0, expenseCategories)
	s.addCategories("income", "", 0, incomeCategories)
	s.addCategories("expense", s.id("system.taxes"), 4, taxCategories)
	s.addCategories("expense", s.id("system.fees"), 7, feeCategories)

	for _, name := range payees {
		s.ids["payee."+name] = s.create("/payees", map[string]any{"name": name})
	}
}

// addCategories creates the categories of list under parent; a category without a color takes the one of its parent.
func (s *seeder) addCategories(class, parent string, inherited int, list []category) {
	for _, c := range list {
		if c.color == 0 {
			c.color = inherited
		}

		body := map[string]any{"name": c.name, "class": class, "currency": "BRL"}
		if c.icon != "" {
			body["icon"] = c.icon
		}

		if c.color > 0 {
			body["color"] = c.color
		}

		if parent != "" {
			body["parent_id"] = parent
		}

		s.ids[c.key] = s.create("/accounts", body)
		s.addCategories(class, s.ids[c.key], c.color, c.children)
	}
}

// openBalances records the opening balance of every account that has one.
func (s *seeder) openBalances(start string) {
	for _, a := range accounts {
		if a.opening == 0 {
			continue
		}

		s.record(start, "Saldo inicial "+a.name, nil,
			post(s.id(a.key), a.opening), post(s.id("system.opening_balances"), -a.opening))
	}
}
