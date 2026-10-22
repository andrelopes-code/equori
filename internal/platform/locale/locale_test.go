package locale_test

import (
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestConventionsOf(t *testing.T) {
	for l, want := range map[locale.Locale]locale.Conventions{
		{"pt", "BR"}: {',', '.', locale.DMY},
		{"en", "US"}: {'.', ',', locale.MDY},
		{"en", "GB"}: {'.', ',', locale.DMY},
		{"de", "DE"}: {',', '.', locale.DMY},
		{"de", "CH"}: {'.', '\'', locale.DMY},
		{"en", "ZZ"}: {'.', ',', locale.YMD},
	} {
		if got := locale.ConventionsOf(l); got != want {
			t.Errorf("ConventionsOf(%v) = %+v, want %+v", l, got, want)
		}
	}
}

func TestEnglishName(t *testing.T) {
	for l, want := range map[locale.Locale]string{{"pt", "BR"}: "Portuguese (Brazil)", {"en", "GB"}: "English (United Kingdom)", {"pt", "AO"}: "Portuguese (AO)"} {
		if got := locale.EnglishName(l); got != want {
			t.Errorf("EnglishName(%v) = %q, want %q", l, got, want)
		}
	}
}

func TestValid(t *testing.T) {
	if !locale.ValidRegion("BR") || locale.ValidRegion("ZZ") || locale.ValidRegion("BRA") || !locale.ValidLanguage("pt") || locale.ValidLanguage("PT") {
		t.Fatal("validation")
	}
}

func TestRegionsAreTheAssignedCodes(t *testing.T) {
	codes := locale.Regions()
	if len(codes) != 249 {
		t.Fatalf("len(Regions()) = %d, want 249", len(codes))
	}
	if !slices.IsSorted(codes) {
		t.Fatal("Regions() is not sorted")
	}
	if slices.Compact(slices.Clone(codes)) == nil || len(slices.Compact(slices.Clone(codes))) != 249 {
		t.Fatal("Regions() has duplicates")
	}
	codes[0] = "XX"
	if locale.Regions()[0] == "XX" {
		t.Fatal("Regions() shares state between calls")
	}
}

func TestTag(t *testing.T) {
	if got := (locale.Locale{Language: "pt", Region: "BR"}).Tag(); got != "pt-BR" {
		t.Fatalf("Tag() = %q", got)
	}
}
