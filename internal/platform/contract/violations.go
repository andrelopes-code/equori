package contract

import (
	"errors"
	"regexp"
	"strconv"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

var (
	unknownMember = regexp.MustCompile(`^property "([^"]+)" is unsupported`)
	missingMember = regexp.MustCompile(`^property "[^"]+" is missing`)
)

func violations(err error) []problem.FieldError {
	var out []problem.FieldError
	seen := map[problem.FieldError]bool{}
	add := func(f problem.FieldError) {
		if !seen[f] {
			seen[f] = true
			out = append(out, f)
		}
	}
	var walk func(err error, field string)
	walk = func(err error, field string) {
		//nolint:errorlint // each layer carries a field name that errors.As would skip by unwrapping
		switch e := err.(type) {
		case openapi3.MultiError:
			for _, inner := range e {
				walk(inner, field)
			}
		case *openapi3filter.RequestError:
			if e.Parameter != nil {
				field = e.Parameter.Name
			}

			if e.Err == nil {
				add(problem.FieldError{Field: orBody(field), Message: e.Reason})
				return
			}

			walk(e.Err, field)
		case *openapi3.SchemaError:
			add(schemaViolation(e, field))
		case *openapi3filter.ParseError:
			add(problem.FieldError{Field: orBody(field), Message: e.Reason})
		default:
			if inner := errors.Unwrap(err); inner != nil {
				walk(inner, field)
				return
			}

			add(problem.FieldError{Field: orBody(field), Message: err.Error()})
		}
	}
	walk(err, "")

	return out
}

func schemaViolation(e *openapi3.SchemaError, param string) problem.FieldError {
	path := e.JSONPointer()
	message := e.Reason
	// The pointer of a missing member already ends with its name; the pointer of an
	// unknown member ends at the object that holds it.
	if m := unknownMember.FindStringSubmatch(e.Reason); m != nil {
		path, message = append(path, m[1]), "is not allowed"
	} else if missingMember.MatchString(e.Reason) {
		message = "is required"
	}

	field := param
	for _, seg := range path {
		if _, err := strconv.Atoi(seg); err == nil {
			field += "[" + seg + "]"
		} else if field == "" {
			field = seg
		} else {
			field += "." + seg
		}
	}

	return problem.FieldError{Field: orBody(field), Message: message}
}

func orBody(field string) string {
	if field == "" {
		return "body"
	}

	return field
}
