import { LocaleType, mergeLocales } from "@univerjs/presets";
import type { ILanguagePack } from "@univerjs/presets";

interface LocalePack {
  default: ILanguagePack;
}

// The texts of the editor in the language of the application: Portuguese for "pt", English for
// every other language. Each language loads only its own files.
export async function loadUniverLocale(
  language: string,
): Promise<{ locale: LocaleType; pack: ILanguagePack }> {
  const portuguese = language === "pt";
  const packs: LocalePack[] = await Promise.all(
    portuguese
      ? [
          import("@univerjs/preset-sheets-core/locales/pt-BR"),
          import("@univerjs/preset-sheets-conditional-formatting/locales/pt-BR"),
          import("@univerjs/preset-sheets-data-validation/locales/pt-BR"),
          import("@univerjs/preset-sheets-drawing/locales/pt-BR"),
          import("@univerjs/preset-sheets-filter/locales/pt-BR"),
          import("@univerjs/preset-sheets-find-replace/locales/pt-BR"),
          import("@univerjs/preset-sheets-hyper-link/locales/pt-BR"),
          import("@univerjs/preset-sheets-note/locales/pt-BR"),
          import("@univerjs/preset-sheets-sort/locales/pt-BR"),
          import("@univerjs/preset-sheets-table/locales/pt-BR"),
        ]
      : [
          import("@univerjs/preset-sheets-core/locales/en-US"),
          import("@univerjs/preset-sheets-conditional-formatting/locales/en-US"),
          import("@univerjs/preset-sheets-data-validation/locales/en-US"),
          import("@univerjs/preset-sheets-drawing/locales/en-US"),
          import("@univerjs/preset-sheets-filter/locales/en-US"),
          import("@univerjs/preset-sheets-find-replace/locales/en-US"),
          import("@univerjs/preset-sheets-hyper-link/locales/en-US"),
          import("@univerjs/preset-sheets-note/locales/en-US"),
          import("@univerjs/preset-sheets-sort/locales/en-US"),
          import("@univerjs/preset-sheets-table/locales/en-US"),
        ],
  );

  return {
    locale: portuguese ? LocaleType.PT_BR : LocaleType.EN_US,
    pack: mergeLocales(...packs.map((p) => p.default)),
  };
}
