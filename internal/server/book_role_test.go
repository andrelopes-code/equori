package server_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// HA12 (amended 2026-11-16): every operation declares its book role, and an owner operation has an
// exclusion or only tools that need the role owner.
func TestBookRoleDeclared(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	doc, err := openapi3.NewLoader().LoadFromData(api.Contract)
	if err != nil {
		t.Fatal(err)
	}

	roles := []string{"public", "read", "write", "owner"}

	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			role, ok := op.Extensions["x-book-role"].(string)
			if !ok || !slices.Contains(roles, role) {
				t.Errorf("operation %s (%s %s) has x-book-role %v, want one of %v",
					op.OperationID, method, path, op.Extensions["x-book-role"], roles)

				continue
			}

			if role != "owner" || strings.HasPrefix(exposure[op.OperationID], "-") {
				continue
			}

			for name := range strings.SplitSeq(exposure[op.OperationID], ",") {
				tl, ok := h.App.Tools.Tool(name)
				if !ok || tl.Spec().Role != auth.RoleOwner {
					t.Errorf(
						"owner operation %s maps to tool %q, want an exclusion or a tool with the role owner",
						op.OperationID,
						name,
					)
				}
			}
		}
	}
}
