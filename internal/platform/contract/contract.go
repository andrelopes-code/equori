// Package contract validates /api/v1 requests against api/openapi.yaml (ADR 007).
package contract

import (
	"bytes"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

var registerFormats sync.Once

// methods are tried in this order to build the Allow header of a 405 response.
var methods = []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}

type Validator struct {
	prefix string
	routes *http.ServeMux // matches requests to operations only; it never serves them
	byKey  map[string]*routers.Route
}

// New loads the document once; prefix is the base path of every operation ("/api/v1").
func New(spec []byte, prefix string) (*Validator, error) {
	registerFormats.Do(func() {
		// kin-openapi keeps string formats in a package registry, and its predefined
		// uuid format accepts versions 1 to 5 only; identifiers are UUIDv7.
		openapi3.DefineStringFormatValidator("uuid", openapi3.NewCallbackValidator(func(s string) error {
			_, err := uuid.Parse(s)
			return err
		}))
	})
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(spec)
	if err != nil {
		return nil, fmt.Errorf("load API contract: %w", err)
	}
	if err := doc.Validate(loader.Context); err != nil {
		return nil, fmt.Errorf("validate API contract: %w", err)
	}
	v := &Validator{prefix: prefix, routes: http.NewServeMux(), byKey: map[string]*routers.Route{}}
	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			pattern := method + " " + prefix + path
			v.routes.Handle(pattern, http.NotFoundHandler())
			// Sessions are checked by identity.RequireSession. An empty requirement list stops
			// kin-openapi from reading the whole body for an authentication function.
			unsecured := *op
			unsecured.Security = &openapi3.SecurityRequirements{}
			v.byKey[pattern] = &routers.Route{Spec: doc, Path: path, PathItem: item, Method: method, Operation: &unsecured}
		}
	}
	return v, nil
}

func (v *Validator) route(r *http.Request) *routers.Route {
	_, pattern := v.routes.Handler(r)
	return v.byKey[pattern]
}

// Middleware rejects a request that does not conform to its operation (C1–C5); requests
// outside the prefix and unknown paths reach next unchanged.
func (v *Validator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, v.prefix+"/") {
			next.ServeHTTP(w, r)
			return
		}
		route := v.route(r)
		if route == nil {
			if allow := v.allowed(r); allow != "" {
				w.Header().Set("Allow", allow)
				write(w, r, problem.New(http.StatusMethodNotAllowed, "method_not_allowed", r.Method+" is not allowed on "+r.URL.Path))
				return
			}
			next.ServeHTTP(w, r)
			return
		}
		if d, ok := v.check(r, route); !ok {
			write(w, r, d)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (v *Validator) allowed(r *http.Request) string {
	var allow []string
	for _, m := range methods {
		probe := r.Clone(r.Context())
		probe.Method = m
		if v.route(probe) != nil {
			allow = append(allow, m)
		}
	}
	return strings.Join(allow, ", ")
}

func write(w http.ResponseWriter, r *http.Request, d problem.Details) {
	d.RequestID = httpserver.RequestID(r.Context())
	problem.Write(w, d)
}

func invalid(errs ...problem.FieldError) problem.Details {
	d := problem.New(http.StatusBadRequest, "invalid_request", "the request does not match the API contract")
	d.Errors = errs
	return d
}

func (v *Validator) check(r *http.Request, route *routers.Route) (problem.Details, bool) {
	opts := &openapi3filter.Options{MultiError: true, SkipSettingDefaults: true}
	if body := route.Operation.RequestBody; body != nil && body.Value != nil {
		mediaType, d, ok := checkMediaType(r, body.Value)
		if !ok {
			return d, false
		}
		switch {
		case strings.HasPrefix(mediaType, "multipart/"):
			opts.ExcludeRequestBody = true // uploads are read once, by the handler
		case mediaType == "application/json":
			if d, ok := checkJSON(r); !ok {
				return d, false
			}
		}
	}
	err := openapi3filter.ValidateRequest(r.Context(), &openapi3filter.RequestValidationInput{
		Request: r, PathParams: pathParams(route.Path, strings.TrimPrefix(r.URL.Path, v.prefix)), Route: route, Options: opts,
	})
	if err == nil {
		return problem.Details{}, true
	}
	if d, ok := problem.Transport(err); ok {
		return d, false
	}
	return invalid(violations(err)...), false
}

// checkMediaType returns the request media type when the operation declares it (C4).
func checkMediaType(r *http.Request, body *openapi3.RequestBody) (string, problem.Details, bool) {
	header := r.Header.Get("Content-Type")
	if header == "" && !body.Required {
		return "", problem.Details{}, true
	}
	mediaType, _, err := mime.ParseMediaType(header)
	if err == nil && body.Content.Get(mediaType) != nil {
		return mediaType, problem.Details{}, true
	}
	declared := make([]string, 0, len(body.Content))
	for t := range body.Content {
		declared = append(declared, t)
	}
	return "", problem.New(http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be "+strings.Join(declared, " or ")), false
}

// checkJSON requires exactly one JSON value and leaves the body readable for the next reader.
func checkJSON(r *http.Request) (problem.Details, bool) {
	b, err := io.ReadAll(r.Body)
	if err != nil {
		if d, ok := problem.Transport(err); ok {
			return d, false
		}
		return invalid(problem.FieldError{Field: "body", Message: "could not be read"}), false
	}
	r.Body = io.NopCloser(bytes.NewReader(b))
	switch {
	case len(bytes.TrimSpace(b)) == 0:
		return invalid(problem.FieldError{Field: "body", Message: "is required"}), false
	case !jsontext.Value(b).IsValid():
		return invalid(problem.FieldError{Field: "body", Message: "must be exactly one JSON value"}), false
	}
	return problem.Details{}, true
}

// pathParams pairs the {name} segments of the template with the request path.
func pathParams(template, path string) map[string]string {
	params := map[string]string{}
	names, values := strings.Split(template, "/"), strings.Split(path, "/")
	for i, n := range names {
		if strings.HasPrefix(n, "{") && strings.HasSuffix(n, "}") && i < len(values) {
			params[n[1:len(n)-1]] = values[i]
		}
	}
	return params
}

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
