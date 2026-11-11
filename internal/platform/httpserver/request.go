package httpserver

import (
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/oapi-codegen/runtime"
)

// Query binds the query string of r into the generated parameter struct P (the XxxParams type of
// the contract). A field without a pointer is a required parameter. The contract validator has
// accepted the request before a handler runs (ADR 007), so an error here means a type the
// contract does not describe.
func Query[P any](r *http.Request) (P, error) {
	var params P

	value := reflect.ValueOf(&params).Elem()
	values := r.URL.Query()

	for i := range value.NumField() {
		field := value.Type().Field(i)

		name, _, _ := strings.Cut(field.Tag.Get("form"), ",")
		if name == "" {
			continue
		}

		required := field.Type.Kind() != reflect.Pointer

		err := runtime.BindQueryParameter("form", true, required, name, values, value.Field(i).Addr().Interface())
		if err != nil {
			return params, fmt.Errorf("query parameter %q: %w", name, err)
		}
	}

	return params, nil
}

// PathUUID returns the path wildcard name as a UUID.
func PathUUID(r *http.Request, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(r.PathValue(name))
	if err != nil {
		return uuid.Nil, fmt.Errorf("path parameter %q: %w", name, err)
	}

	return id, nil
}

// PathInt64 returns the path wildcard name as an int64.
func PathInt64(r *http.Request, name string) (int64, error) {
	n, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("path parameter %q: %w", name, err)
	}

	return n, nil
}
