import type { CompanyFigures } from "@/features/instruments/company-report/company-figures";
import { CompanyFigureGrid } from "@/features/instruments/company-report/company-figure-grid";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/display/figure-card";

interface CompanyReportFiguresProps {
  figures: CompanyFigures;
}

// The four figures of CR8 to CR10. A null figure is written in words, never as zero.
export function CompanyReportFigures({ figures }: CompanyReportFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const percent = numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const ratio = numberFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const text = (
    value: number | null | "notApplicable",
    format: { format: (value: number) => string },
  ) => {
    if (value === "notApplicable") return t("companyReport.notApplicable");
    if (value === null) return t("companyReport.missing");

    return format.format(value);
  };
  const plan = t("companyReport.note.plan");
  const window =
    figures.window === null
      ? ""
      : t("companyReport.note.window", {
          date: formatDate(figures.window, locale),
        });
  const balance = t("companyReport.note.balance", {
    date: formatDate(figures.balance, locale),
  });
  const years = figures.positiveYears;

  return (
    <CompanyFigureGrid label={t("companyReport.title")}>
      <FigureCard
        label={t("companyReport.returnOnEquity")}
        value={text(figures.returnOnEquity, percent)}
        note={window}
        goodWhen="none"
      />

      <FigureCard
        label={t("companyReport.netMargin")}
        value={text(figures.netMargin, percent)}
        note={figures.netMargin === "notApplicable" ? plan : window}
        goodWhen="none"
      />

      <FigureCard
        label={t("companyReport.netDebt")}
        value={text(figures.netDebtToEquity, ratio)}
        note={figures.netDebtToEquity === "notApplicable" ? plan : balance}
        goodWhen="none"
      />

      <FigureCard
        label={t("companyReport.positiveYears")}
        value={
          years === null
            ? t("companyReport.missing")
            : t("companyReport.yearsValue", {
                positive: String(years.positive),
                count: String(years.count),
              })
        }
        note={
          years === null
            ? ""
            : t("companyReport.note.years", { count: String(years.count) })
        }
        goodWhen="none"
      />
    </CompanyFigureGrid>
  );
}
