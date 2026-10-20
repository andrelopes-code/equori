// Package tool defines the operations language models call, and their registry (ADR 012).
package tool

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/google/jsonschema-go/jsonschema"
)

type Effect int

const (
	ReadOnly Effect = iota + 1
	Write
	Destructive
)

func (e Effect) String() string {
	switch e {
	case ReadOnly:
		return "read_only"
	case Write:
		return "write"
	case Destructive:
		return "destructive"
	}
	return fmt.Sprintf("Effect(%d)", int(e))
}

type Spec struct {
	Name        string
	Description string
	Effect      Effect
	// Idempotent reports that repeating a call with the same arguments changes nothing more.
	Idempotent bool
}

// Tool is a Spec with its schemas and its handler, with the argument and result types erased.
type Tool struct {
	spec          Spec
	input, output *jsonschema.Schema
	in, out       *jsonschema.Resolved
	call          func(ctx context.Context, userID int64, args []byte) (any, error)
}

var namePattern = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)

// New builds a tool from a typed handler. It panics on a definition ADR 012 rejects, so a
// broken tool stops startup.
func New[In, Out any](s Spec, h func(ctx context.Context, userID int64, in In) (Out, error)) Tool {
	switch {
	case !namePattern.MatchString(s.Name):
		panic(fmt.Sprintf("tool %q: name must match %s", s.Name, namePattern))
	case s.Description == "":
		panic(fmt.Sprintf("tool %s: empty description", s.Name))
	case s.Effect < ReadOnly || s.Effect > Destructive:
		panic(fmt.Sprintf("tool %s: invalid effect %d", s.Name, s.Effect))
	}
	input, in, err := schemaFor[In]()
	if err != nil {
		panic(fmt.Sprintf("tool %s: input: %v", s.Name, err))
	}
	output, out, err := schemaFor[Out]()
	if err != nil {
		panic(fmt.Sprintf("tool %s: output: %v", s.Name, err))
	}
	return Tool{
		spec: s, input: input, output: output, in: in, out: out,
		call: func(ctx context.Context, userID int64, args []byte) (any, error) {
			var v In
			if err := json.Unmarshal(args, &v); err != nil {
				return nil, err
			}
			return h(ctx, userID, v)
		},
	}
}

func (t Tool) Spec() Spec                       { return t.spec }
func (t Tool) InputSchema() *jsonschema.Schema  { return t.input }
func (t Tool) OutputSchema() *jsonschema.Schema { return t.output }

// ValidateOutput checks a result against the output schema; tests run it on every result.
func (t Tool) ValidateOutput(content json.RawMessage) error {
	var v any
	if err := json.Unmarshal(content, &v); err != nil {
		return err
	}
	return t.out.Validate(v)
}
