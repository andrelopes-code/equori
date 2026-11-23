package app

import (
	"encoding/json"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// TestPreviewWaitingAction names a waiting proposal as its tool names the promoted one.
func TestPreviewWaitingAction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		tool, arguments, want string
	}{
		{"manage_rule", `{"action":"create_rule"}`, "manage_rule.create_rule"},
		{"record_investment", `{"kind":"sell"}`, "record_investment.sell"},
		{"record_corporate_action", `{"kind":"split"}`, "record_corporate_action.split"},
		{"manage_schedule", `{"action":"create","kind":"income"}`, "manage_schedule.create"},
		{"transfer_custody", `{"kind":"in"}`, "transfer_custody"},
		{"record_transaction", `{}`, "record_transaction"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			t.Parallel()

			p := domain.Proposal{Tool: tt.tool, Arguments: []byte(tt.arguments)}

			if err := (&Service{}).previewWaiting(&p); err != nil {
				t.Fatalf("previewWaiting: %v", err)
			}

			var got struct {
				Action string `json:"action"`
			}

			if err := json.Unmarshal(p.Preview, &got); err != nil || got.Action != tt.want {
				t.Fatalf("action = %q (%v), want %q", got.Action, err, tt.want)
			}
		})
	}
}
