package tool

import (
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/google/jsonschema-go/jsonschema"
)

// Enumerated is a named string type whose schema lists its values as an enum.
type Enumerated interface{ Values() []string }

// keywords are the schema keywords every provider accepts (ADR 012 T4). A keyword joins
// the list after a Gemini request using it succeeds.
var keywords = map[string]bool{
	"type": true, "properties": true, "required": true, "items": true, "enum": true, "format": true,
	"description": true, "additionalProperties": true, "minimum": true, "maximum": true,
}

var (
	dateType       = reflect.TypeFor[Date]()
	enumeratedType = reflect.TypeFor[Enumerated]()
)

// schemaFor infers the schema of T, a struct, and checks it against the keyword list.
func schemaFor[T any]() (*jsonschema.Schema, *jsonschema.Resolved, error) {
	t := reflect.TypeFor[T]()
	if t.Kind() != reflect.Struct {
		return nil, nil, fmt.Errorf("%s is not a struct, and the schema must be an object", t)
	}
	types := map[reflect.Type]*jsonschema.Schema{}
	collectTypes(t, types, map[reflect.Type]bool{})
	s, err := jsonschema.For[T](&jsonschema.ForOptions{TypeSchemas: types})
	if err != nil {
		return nil, nil, err
	}
	b, err := json.Marshal(s)
	if err != nil {
		return nil, nil, err
	}
	var node any
	if err := json.Unmarshal(b, &node); err != nil {
		return nil, nil, err
	}
	if err := checkKeywords(node, "#"); err != nil {
		return nil, nil, err
	}
	r, err := s.Resolve(nil)
	if err != nil {
		return nil, nil, err
	}
	return s, r, nil
}

// collectTypes registers the schemas inference cannot derive: Date and Enumerated types.
func collectTypes(t reflect.Type, types map[reflect.Type]*jsonschema.Schema, seen map[reflect.Type]bool) {
	if seen[t] {
		return
	}
	seen[t] = true
	switch {
	case t == dateType:
		types[t] = &jsonschema.Schema{Type: "string", Format: "date"}
		return
	case t.Kind() == reflect.String && t.Implements(enumeratedType):
		values := reflect.Zero(t).Interface().(Enumerated).Values()
		enum := make([]any, len(values))
		for i, v := range values {
			enum[i] = v
		}
		types[t] = &jsonschema.Schema{Type: "string", Enum: enum}
		return
	}
	switch t.Kind() {
	case reflect.Struct:
		for f := range t.Fields() {
			collectTypes(f.Type, types, seen)
		}
	case reflect.Slice, reflect.Array, reflect.Pointer, reflect.Map:
		collectTypes(t.Elem(), types, seen)
	}
}

func checkKeywords(node any, path string) error {
	s, ok := node.(map[string]any)
	if !ok {
		return fmt.Errorf("%s: schema is not an object", path)
	}
	for k := range s {
		if !keywords[k] {
			return fmt.Errorf("%s: keyword %q is outside ADR 012 T4", path, k)
		}
	}
	if _, ok := s["type"].(string); !ok {
		return fmt.Errorf("%s: type must be one string, got %v", path, s["type"])
	}
	if ap, ok := s["additionalProperties"]; ok && ap != false {
		return fmt.Errorf("%s: additionalProperties must be false", path)
	}
	if props, ok := s["properties"].(map[string]any); ok {
		for name, p := range props {
			if err := checkKeywords(p, path+"/properties/"+name); err != nil {
				return err
			}
		}
	}
	if items, ok := s["items"]; ok {
		return checkKeywords(items, path+"/items")
	}
	return nil
}
