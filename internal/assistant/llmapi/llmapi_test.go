package llmapi

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// The Anthropic API takes its key in X-Api-Key and refuses a request without its version
// header with status 400.
func TestFactoryHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		api                         domain.API
		version, key, authorization string
	}{
		{api: domain.APIAnthropic, version: "2023-06-01", key: "k"},
		{api: domain.APIOpenAI, authorization: "Bearer k"},
	}
	for _, tt := range tests {
		t.Run(string(tt.api), func(t *testing.T) {
			t.Parallel()
			var version, key, authorization string
			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					version = r.Header.Get("Anthropic-Version")
					key = r.Header.Get("X-Api-Key")
					authorization = r.Header.Get("Authorization")
					_, _ = io.WriteString(w, `{"data":[{"id":"claude-a"}]}`)
				}),
			)
			t.Cleanup(srv.Close)

			lister, ok := NewFactory()(string(tt.api), srv.URL+"/v1", "k").(llm.ModelLister)
			if !ok {
				t.Fatalf("provider of %s lists no models", tt.api)
			}

			models, err := lister.Models(context.Background())
			if err != nil {
				t.Fatalf("Models: %v", err)
			}

			if version != tt.version || key != tt.key || authorization != tt.authorization {
				t.Fatalf(
					"version %q, key %q, authorization %q; want %q, %q, %q",
					version,
					key,
					authorization,
					tt.version,
					tt.key,
					tt.authorization,
				)
			}

			if !slices.Equal(models, []string{"claude-a"}) {
				t.Fatalf("models = %v, want [claude-a]", models)
			}
		})
	}
}
