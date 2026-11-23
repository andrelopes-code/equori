package apitest

import (
	"context"
	"net/http"
	"testing"
)

// The company X of the hand-computed cases of the contribution criteria (AC17).
const (
	companyListing = `INSERT INTO marketdata_company_listing
		(source, exchange, code, identifier, name, shares_per_unit)
	VALUES ('br_cvm_cia', 'BVMF', $2, $1, 'X S.A.', 1)`
	companyCount = `INSERT INTO marketdata_company_share_count (source, identifier, year, shares)
	VALUES ('br_cvm_cia', $1, 2026, 1010000)`
	companyReports = `INSERT INTO marketdata_company_report (source, identifier, period, months, file, currency,
		name, consolidated, plan, total_assets, current_assets, current_liabilities, short_debt,
		long_debt, cash, short_investments, equity, equity_minority, revenue, gross_profit,
		net_income, net_income_parent, shares_issued, shares_treasury)
	VALUES
		('br_cvm_cia', $1, '2026-09-30', 9, 'itr_2026', 'BRL', 'X S.A.', true, 'standard',
			120000000, 45000000, 30000000, 5000000, 20000000, 4000000, 1000000, 50000000,
			4000000, 90000000, 36000000, 9000000, 9000000, 1010, 10),
		('br_cvm_cia', $1, '2025-12-31', 12, 'dfp_2025', 'BRL', 'X S.A.', true, 'standard',
			NULL, NULL, NULL, NULL, NULL, NULL, NULL, 45000000, 4000000, 100000000, 40000000,
			10000000, 10000000, NULL, NULL),
		('br_cvm_cia', $1, '2025-09-30', 9, 'itr_2025', 'BRL', 'X S.A.', true, 'standard',
			NULL, NULL, NULL, NULL, NULL, NULL, NULL, 44000000, 4000000, 75000000, 30000000,
			7500000, 7500000, NULL, NULL)`
)

// SeedCompany stores the filings of the company X under code, its price of 1.15 on 2026-10-30, and
// enables the source of the filings. The instrument exists and is quoted in BRL.
func (h *Harness) SeedCompany(t *testing.T, code, identifier string) {
	t.Helper()

	for sql, args := range map[string][]any{
		companyListing: {identifier, code},
		companyCount:   {identifier},
		companyReports: {identifier},
	} {
		if _, err := h.Pool.Exec(context.Background(), sql, args...); err != nil {
			t.Fatalf("seed the company of %s: %v", code, err)
		}
	}

	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": code, "quote_instrument": "BRL", "date": "2026-10-30", "value": "1.15",
	}, http.StatusCreated, nil)
	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_cvm_cia",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)
}
