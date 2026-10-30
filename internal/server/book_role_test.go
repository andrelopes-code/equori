package server_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/andrelopes-code/equori/api"
)

// HA12: every operation declares its book role, and an owner operation has no tool.
func TestBookRoleDeclared(t *testing.T) {
	t.Parallel()

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

			if role == "owner" && !strings.HasPrefix(exposure[op.OperationID], "-") {
				t.Errorf("owner operation %s has exposure %q, want an exclusion", op.OperationID, exposure[op.OperationID])
			}
		}
	}
}
