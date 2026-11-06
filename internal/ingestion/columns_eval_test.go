//go:build eval

package ingestion_test

import (
	"encoding/json"
	"net/http"
	"os"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/aistudio"
	"github.com/andrelopes-code/equori/internal/platform/llm/openai"
)

const minColumnScore = 0.8

type evalProvider struct {
	ID string `json:"id"`
}

type evalSuggestion struct {
	DateColumn        string `json:"date_column"`
	DescriptionColumn string `json:"description_column"`
	AmountColumn      string `json:"amount_column"`
	DebitColumn       string `json:"debit_column"`
	CreditColumn      string `json:"credit_column"`
	IDColumn          string `json:"id_column"`
	SignColumn        string `json:"sign_column"`
}

// TestColumnSuggestionEval posts each synthetic file to the operation with the real provider.
func TestColumnSuggestionEval(t *testing.T) {
	provider, model := os.Getenv("EQUORI_EVAL_PROVIDER"), os.Getenv("EQUORI_EVAL_MODEL")
	if provider == "" || model == "" {
		t.Fatal("set EQUORI_EVAL_PROVIDER to a preset and EQUORI_EVAL_MODEL to a model")
	}

	h := evalHarness(t, provider, model)
	account := h.Account("Evaluation checking", "asset", "checking", nil)

	answers := make([]columnPositions, len(columnCases))

	for i, c := range columnCases {
		body := map[string]any{"rows": c.Rows}
		if c.Header != nil {
			body["header"] = c.Header
		}

		var got evalSuggestion
		r := h.Do(http.MethodPost, suggestionPath(account), body)

		if r.Status == http.StatusOK {
			if err := json.Unmarshal(r.Body, &got); err != nil {
				t.Fatalf("%s: decode %s: %v", c.Name, r.Body, err)
			}

			answers[i] = positionsOf(c.Header, got)
		}

		t.Logf("%s: status %d, answer %+v, expected %+v", c.Name, r.Status, answers[i], c.Expected)
	}

	score := scoreColumnAnswers(columnCases, answers)
	t.Logf("score %.2f", score)

	if score < minColumnScore {
		t.Fatalf("score = %.2f, want at least %.2f", score, minColumnScore)
	}
}

func evalHarness(t *testing.T, preset, model string) *apitest.Harness {
	t.Helper()

	hc := &http.Client{Timeout: 2 * time.Minute}
	h := apitest.New(t, apitest.SecretKeys(apitest.SecretKey, ""),
		apitest.LLMFactory(func(api, baseURL, key string) llm.Provider {
			if api == "gemini" {
				return aistudio.New(baseURL, key, hc)
			}

			return openai.New(baseURL, key, hc)
		}))

	body := map[string]any{"preset": preset, "name": "Evaluation"}
	if key := os.Getenv("EQUORI_EVAL_KEY"); key != "" {
		body["key"] = key
	}

	if baseURL := os.Getenv("EQUORI_EVAL_BASE_URL"); baseURL != "" {
		body["base_url"] = baseURL
	}

	var created evalProvider
	h.MustDo(http.MethodPost, "/api/v1/assistant/providers", body, http.StatusCreated, &created)
	h.MustDo(http.MethodPut, "/api/v1/assistant/uses/ingestion.csv_columns/chain", map[string]any{"targets": []any{
		map[string]any{"provider_id": created.ID, "model": model, "capabilities": []string{"structured_output"}},
	}}, http.StatusOK, nil)

	return h
}

// positionsOf maps header names, or positions as text, back to 1-based positions.
func positionsOf(header []string, s evalSuggestion) columnPositions {
	at := func(name string) int {
		if name == "" {
			return 0
		}

		if header == nil {
			n, _ := strconv.Atoi(name)

			return n
		}

		return slices.Index(header, name) + 1
	}

	return columnPositions{
		Date: at(s.DateColumn), Description: at(s.DescriptionColumn), Amount: at(s.AmountColumn),
		Debit: at(s.DebitColumn), Credit: at(s.CreditColumn), ID: at(s.IDColumn), Sign: at(s.SignColumn),
	}
}
