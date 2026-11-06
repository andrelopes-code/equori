package ingestion_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

const columnsAnswer = `{"date":1,"description":2,"amount":3,"debit":0,"credit":0,"id":0,"sign":0}`

type columnSuggestion struct {
	DateColumn        string `json:"date_column"`
	DescriptionColumn string `json:"description_column"`
	AmountColumn      string `json:"amount_column"`
}

// S298.
func TestSuggestColumnsS298(t *testing.T) {
	t.Parallel()

	provider := llmtest.New("aistudio", columnsStep(columnsAnswer))
	h := apitest.New(t, apitest.LLM(provider))
	checking := h.Account("Nubank checking", "asset", "checking", nil)

	var got columnSuggestion
	h.MustDo(http.MethodPost, suggestionPath(checking), sampleBody(), http.StatusOK, &got)

	if want := (columnSuggestion{DateColumn: "Data", DescriptionColumn: "Hist", AmountColumn: "Valor"}); got != want {
		t.Fatalf("suggestion = %+v, want %+v", got, want)
	}

	calls := provider.Requests()
	if len(calls) != 1 {
		t.Fatalf("calls = %d, want 1", len(calls))
	}

	req := calls[0].Request
	text := req.Messages[0].Parts[0].Text

	for _, want := range []string{"Data | Hist | Valor", "99/99/9999 | AAA AAAA AAAAA 999 | -9.999,99"} {
		if !strings.Contains(text, want) {
			t.Errorf("request text lacks %q:\n%s", want, text)
		}
	}

	for _, leak := range []string{"JOAO", "2026", "1.234"} {
		if strings.Contains(text, leak) {
			t.Errorf("request text holds %q:\n%s", leak, text)
		}
	}

	if req.Temperature == nil || *req.Temperature != 0 || req.MaxOutputTokens != 128 {
		t.Errorf("temperature = %v, max output tokens = %d", req.Temperature, req.MaxOutputTokens)
	}

	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+checking+"/csv-profile", nil),
		http.StatusNotFound, "not_found", "")

	var uses struct {
		Items []struct {
			ID                 string `json:"id"`
			SendsFinancialData bool   `json:"sends_financial_data"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/uses", nil, http.StatusOK, &uses)

	var listed bool

	for _, u := range uses.Items {
		if u.ID == "ingestion.csv_columns" {
			listed = u.SendsFinancialData
		}
	}

	if !listed {
		t.Fatalf("uses = %+v, want ingestion.csv_columns with sends_financial_data", uses.Items)
	}
}

// S299.
func TestSuggestColumnsUnusableS299(t *testing.T) {
	t.Parallel()

	provider := llmtest.New("aistudio", columnsStep(`{"date":0,"description":2,"amount":3,"debit":0,"credit":0,"id":0,"sign":0}`))
	h := apitest.New(t, apitest.LLM(provider))
	checking := h.Account("Nubank checking", "asset", "checking", nil)

	h.ExpectProblem(h.Do(http.MethodPost, suggestionPath(checking), sampleBody()),
		http.StatusUnprocessableEntity, "csv_suggestion_unusable", "")
}

// S300.
func TestSuggestColumnsUnavailableS300(t *testing.T) {
	t.Parallel()

	quota := llmtest.New("aistudio", llmtest.Step{Model: "gemini-3.5-flash-lite", Err: &llm.QuotaError{}})
	h := apitest.New(t, apitest.LLM(quota))
	checking := h.Account("Nubank checking", "asset", "checking", nil)

	h.ExpectProblem(h.Do(http.MethodPost, suggestionPath(checking), sampleBody()),
		http.StatusServiceUnavailable, "csv_suggestion_unavailable", "")

	bare := apitest.New(t)
	account := bare.Account("Nubank checking", "asset", "checking", nil)

	bare.ExpectProblem(bare.Do(http.MethodPost, suggestionPath(account), sampleBody()),
		http.StatusServiceUnavailable, "csv_suggestion_unavailable", "")
}

func TestSuggestColumnsContract(t *testing.T) {
	t.Parallel()

	provider := llmtest.New("aistudio", columnsStep(columnsAnswer))
	h := apitest.New(t, apitest.LLM(provider))
	checking := h.Account("Nubank checking", "asset", "checking", nil)

	rows := make([][]string, 13)
	for i := range rows {
		rows[i] = []string{"03/11/2026", "x", "1,00"}
	}

	r := h.Do(http.MethodPost, suggestionPath(checking), map[string]any{"rows": rows})
	if r.Status != http.StatusBadRequest {
		t.Fatalf("13 rows: status = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(h.Do(http.MethodPost, suggestionPath("00000000-0000-4000-8000-000000000000"), sampleBody()),
		http.StatusNotFound, "not_found", "")

	if n := len(provider.Requests()); n != 0 {
		t.Fatalf("calls = %d, want 0", n)
	}
}

func suggestionPath(account string) string {
	return "/api/v1/accounts/" + account + "/csv-profile/suggestion"
}

func sampleBody() map[string]any {
	return map[string]any{
		"header": []string{"Data", "Hist", "Valor"},
		"rows":   [][]string{{"03/11/2026", "PIX JOAO SILVA 123", "-1.234,56"}},
	}
}

func columnsStep(text string) llmtest.Step {
	return llmtest.Step{Model: "gemini-3.5-flash-lite", Response: llm.Response{
		Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: text}}},
		FinishReason: llm.FinishStop,
	}}
}
