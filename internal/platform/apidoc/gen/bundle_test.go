package main

import (
	"strings"
	"testing"
)

func TestBundle(t *testing.T) {
	base := "openapi: 3.0.3\ninfo:\n  title: t\n"
	shared := "securitySchemes:\n  cookie:\n    type: apiKey\nschemas:\n  Money:\n    type: string\n"
	ledger := "paths:\n  /accounts:\n    get:\n      tags: [ledger]\nschemas:\n  Account:\n    type: object\n"
	planning := "paths:\n  /budgets:\n    get:\n      tags: [planning]\nparameters:\n  Month:\n    name: month\n"

	want := strings.Join([]string{
		bundleHeader,
		"openapi: 3.0.3",
		"info:",
		"  title: t",
		"paths:",
		"  /accounts:",
		"    get:",
		"      tags: [ledger]",
		"  /budgets:",
		"    get:",
		"      tags: [planning]",
		"components:",
		"  securitySchemes:",
		"    cookie:",
		"      type: apiKey",
		"  parameters:",
		"    Month:",
		"      name: month",
		"  schemas:",
		"    Money:",
		"      type: string",
		"    Account:",
		"      type: object",
		"",
	}, "\n")

	got, err := bundle(base, []string{shared, ledger, planning})
	if err != nil {
		t.Fatal(err)
	}

	if got != want {
		t.Errorf("bundle mismatch\ngot:\n%s\nwant:\n%s", got, want)
	}
}

func TestBundleKeepsBlankLinesOfBlockScalars(t *testing.T) {
	fragment := "schemas:\n  Note:\n    description: |\n      one\n\n      two\n"

	got, err := bundle("openapi: 3.0.3\n", []string{fragment})
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(got, "      one\n\n        two\n") {
		t.Errorf("blank line or indentation of the block scalar changed:\n%s", got)
	}
}

func TestBundleRejectsContentOutsideASection(t *testing.T) {
	_, err := bundle("openapi: 3.0.3\n", []string{"stray: value\n"})
	if err == nil {
		t.Fatal("expected an error for a line outside a section")
	}
}
