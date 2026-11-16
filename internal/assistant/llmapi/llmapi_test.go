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

// The Anthropic API refuses a request without its version header with status 400.
func TestFactoryVersionHeader(t *testing.T) {
	t.Parallel()

	tests := []struct {
		api  domain.API
		want string
	}{
		{api: domain.APIAnthropic, want: "2023-06-01"},
		{api: domain.APIOpenAI, want: ""},
	}
	for _, tt := range tests {
		t.Run(string(tt.api), func(t *testing.T) {
			t.Parallel()
			var version, authorization string
			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					version = r.Header.Get("Anthropic-Version")
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

			if version != tt.want || authorization != "Bearer k" {
				t.Fatalf("version %q, authorization %q; want %q", version, authorization, tt.want)
			}

			if !slices.Equal(models, []string{"claude-a"}) {
				t.Fatalf("models = %v, want [claude-a]", models)
			}
		})
	}
}
