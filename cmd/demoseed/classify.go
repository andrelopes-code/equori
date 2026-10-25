package main

import (
	"fmt"
	"net/http"
	"os"
)

type rule struct {
	name       string
	conditions []map[string]any
	actions    func(s *seeder) []map[string]any
	stop       bool
}

func contains(field, value string) map[string]any {
	return map[string]any{"field": field, "operator": "contains", "value": value}
}

func inList(field string, values ...string) map[string]any {
	return map[string]any{"field": field, "operator": "in_list", "value": values}
}

func setCategory(key string) func(s *seeder) []map[string]any {
	return func(s *seeder) []map[string]any {
		return []map[string]any{{"type": "set_category", "category_id": s.id(key)}}
	}
}

// rules run by creation order: the more specific rules come first.
var rules = []rule{
	{name: "Uber Eats é delivery", conditions: []map[string]any{contains("description", "uber *eats")}, stop: true,
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "set_category", "category_id": s.id("food.delivery")}, {"type": "set_payee", "payee_id": s.id("payee.Uber")}}
		}},
	{name: "Corridas de Uber", conditions: []map[string]any{contains("description", "uber *trip")},
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "set_category", "category_id": s.id("transport.rideshare")}, {"type": "set_payee", "payee_id": s.id("payee.Uber")}}
		}},
	{name: "Corridas de 99", conditions: []map[string]any{contains("description", "99 *corrida")},
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "set_category", "category_id": s.id("transport.rideshare")}, {"type": "set_payee", "payee_id": s.id("payee.99")}}
		}},
	{name: "Pedidos do iFood", conditions: []map[string]any{contains("description", "ifood")},
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "set_category", "category_id": s.id("food.delivery")}, {"type": "set_payee", "payee_id": s.id("payee.iFood")}}
		}},
	{name: "Farmácias", conditions: []map[string]any{inList("description", "drogasil", "droga raia", "pague menos")},
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "set_category", "category_id": s.id("health.pharmacy")}, {"type": "add_tags", "tags": []string{"saude"}}}
		}},
	{name: "Compra grande no hipermercado: mercado e casa", conditions: []map[string]any{
		contains("description", "carrefour hiper"), {"field": "absolute_amount", "operator": "greater_than", "value": brl(30000)},
	}, stop: true,
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "split", "parts": []map[string]any{
				{"category_id": s.id("food.groceries"), "percent": 80},
				{"category_id": s.id("housing.decor"), "remainder": true},
			}}}
		}},
	{name: "Supermercados", conditions: []map[string]any{inList("description", "pao de acucar", "carrefour", "mercado dia", "emporio santa luzia")}, actions: setCategory("food.groceries")},
	{name: "Cafeterias", conditions: []map[string]any{inList("description", "starbucks", "santo grao")}, actions: setCategory("food.coffee")},
	{name: "Padarias", conditions: []map[string]any{contains("description", "padaria")}, actions: setCategory("food.bakery")},
	{name: "Streaming e música", conditions: []map[string]any{inList("description", "netflix", "spotify", "disney", "hbo")},
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "set_category", "category_id": s.id("leisure.streaming")}, {"type": "add_tags", "tags": []string{"assinatura"}}}
		}},
	{name: "Academia", conditions: []map[string]any{inList("description", "smartfit", "smart fit")}, actions: setCategory("health.gym")},
	{name: "Aluguel", conditions: []map[string]any{contains("description", "quintoandar")}, actions: setCategory("housing.rent")},
	{name: "Aportes na corretora são transferências", conditions: []map[string]any{contains("description", "xp investimentos")},
		actions: func(s *seeder) []map[string]any {
			return []map[string]any{{"type": "transfer", "account_id": s.id("xp.cash")}}
		}},
}

// aliases map the raw text of a statement line to a payee.
var aliases = []struct{ pattern, match, payee string }{
	{"ifood", "contains", "iFood"},
	{"uber *", "starts_with", "Uber"},
	{"99 *", "starts_with", "99"},
	{"drogasil", "contains", "Drogasil"},
	{"droga raia", "contains", "Droga Raia"},
	{"pao de acucar", "contains", "Pão de Açúcar"},
	{"carrefour", "contains", "Carrefour"},
	{"smartfit", "contains", "Smart Fit"},
	{"netflix", "contains", "Netflix"},
	{"spotify", "contains", "Spotify"},
	{"^amazon( marketplace|\\.com\\.br|mktp)?", "regex", "Amazon"},
	{"kabum", "contains", "KaBuM!"},
	{"starbucks", "contains", "Starbucks"},
	{"padaria bella", "contains", "Padaria Bella Paulista"},
}

func (s *seeder) buildRules() {
	for _, r := range rules {
		s.create("/rules", map[string]any{"name": r.name, "conditions": r.conditions, "actions": r.actions(s), "stop_processing": r.stop})
	}
	for _, a := range aliases {
		s.create("/payee-aliases", map[string]any{"pattern": a.pattern, "match_type": a.match, "payee_id": s.id("payee." + a.payee)})
	}
}

// runRules categorizes the uncategorized transactions and reports the counts on standard error.
func (s *seeder) runRules() error {
	var out struct{ Examined, Categorized int }
	s.do(http.MethodPost, "/rules/run", nil, &out)
	if s.err == nil {
		fmt.Fprintf(os.Stderr, "rules examined %d transactions and categorized %d\n", out.Examined, out.Categorized)
	}
	return s.err
}
