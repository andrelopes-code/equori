import type { CompanyFigures } from "@/features/instruments/company-report/company-figures";
import {
  formatDate,
  formatReferenceMonth,
  numberFormatter,
} from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

export interface AssetFactsInput {
  fund: {
    priceToBook: number | null;
    yearYield: number | null;
    period: string;
  } | null;
  company: CompanyFigures | null;
}

export function assetFactsText(
  input: AssetFactsInput,
  t: TFunction,
  locale: string,
): string {
  const figures = figureWriter(t, locale);
  const { fund, company } = input;

  if (fund !== null) {
    return t("assetFacts.fund", {
      priceToBook: figures.decimal(fund.priceToBook),
      yearYield: figures.percent(fund.yearYield),
      month: formatReferenceMonth(fund.period, locale),
    });
  }

  if (company !== null) return companyText(company, figures, t, locale);

  return t("assetFacts.none");
}

interface FigureWriter {
  decimal: (value: number | null | "notApplicable") => string;
  percent: (value: number | null | "notApplicable") => string;
  missing: string;
}

function figureWriter(t: TFunction, locale: string): FigureWriter {
  const decimal = numberFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const percent = numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const missing = t("assetFacts.missing");
  const write =
    (format: typeof decimal) => (value: number | null | "notApplicable") => {
      if (value === "notApplicable") return t("assetFacts.notApplicable");

      return value === null ? missing : format.format(value);
    };

  return { decimal: write(decimal), percent: write(percent), missing };
}

function companyText(
  company: CompanyFigures,
  figures: FigureWriter,
  t: TFunction,
  locale: string,
): string {
  const years = company.positiveYears;

  return t("assetFacts.company", {
    roe: figures.percent(company.returnOnEquity),
    margin: figures.percent(company.netMargin),
    netDebt: figures.decimal(company.netDebtToEquity),
    years:
      years === null
        ? t("assetFacts.yearsMissing")
        : t("assetFacts.years", {
            positive: String(years.positive),
            count: String(years.count),
          }),
    window:
      company.window === null
        ? t("assetFacts.windowMissing")
        : t("assetFacts.window", { date: formatDate(company.window, locale) }),
  });
}
