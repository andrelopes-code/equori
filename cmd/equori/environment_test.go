package main

import (
	"slices"
	"testing"
)

func TestEnvNames(t *testing.T) {
	t.Parallel()

	got := envNames(
		[]string{"EQUORI_A=1", "PATH=/bin", "EQUORI_B=x=y"},
		map[string]string{"EQUORI_A": "2", "EQUORI_C": "3"},
	)

	want := []string{"EQUORI_A", "EQUORI_B", "EQUORI_C"}
	if !slices.Equal(got, want) {
		t.Fatalf("envNames = %v, want %v", got, want)
	}
}
