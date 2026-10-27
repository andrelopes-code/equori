package domain

import (
	"reflect"
	"strings"
	"testing"
)

// Every wording fills each field with the verbs of English, so no description reads empty or
// drops its argument.
func TestWordingsFillEveryField(t *testing.T) {
	t.Parallel()
	english := reflect.ValueOf(English())
	for name, w := range map[string]Wording{"pt": Portuguese()} {
		v := reflect.ValueOf(w)
		for i := range v.NumField() {
			field, got, want := v.Type().Field(i).Name, v.Field(i).String(), english.Field(i).String()
			if got == "" || strings.Count(got, "%s") != strings.Count(want, "%s") {
				t.Errorf("%s.%s = %q, want the %d verbs of %q", name, field, got, strings.Count(want, "%s"), want)
			}
		}
	}
}
