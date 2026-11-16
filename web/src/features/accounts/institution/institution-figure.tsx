import { Sparkline } from "@slotted/react/sparkline";

import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";
import type { IndicatorFigure } from "@/features/accounts/institution/indicator-figures";

interface InstitutionFigureProps {
  figure: IndicatorFigure;
  // The currency of the amounts of the institution, from the record.
  currency: string;
  scale: (code: string) => number;
}

// One indicator: its newest value, the floor it is read against and the trend of its quarters.
export function InstitutionFigure({
  figure,
  currency,
  scale,
}: InstitutionFigureProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const label = t(`institution.${figure.id}`);
  const percent = (bp: number) => formatBasisPoints(bp, locale);

  return (
    <FigureCard
      label={label}
      value={value()}
      note={note()}
      goodWhen="none"
      attention={figure.attention}
      trend={
        figure.trend.length >= 2 && (
          <Sparkline
            size="sm"
            data={figure.trend}
            label={t("institution.trend", {
              name: label,
              count: figure.trend.length,
            })}
            valueFormatter={
              figure.kind === "ratio"
                ? percent
                : (v: number) =>
                    fmt.money({ amount: v, currency }, scale(currency))
            }
          />
        )
      }
    />
  );

  function value() {
    if (figure.kind === "ratio") {
      return figure.basisPoints === null
        ? t("institution.notInformed")
        : percent(figure.basisPoints);
    }
    return figure.money === null
      ? t("institution.notInformed")
      : { money: figure.money, scale: scale(figure.money.currency) };
  }

  function note() {
    if (figure.id !== "basel" && figure.id !== "principalCapital") {
      return t(`institution.note.${figure.id}`);
    }
    // The two ratios the rule sets a floor for always carry it.
    if (figure.floor === undefined) return "";
    if (figure.attention === "danger") {
      return t("institution.floor.danger", {
        minimum: percent(figure.floor.minimum),
      });
    }
    if (figure.attention === "warning") {
      return t("institution.floor.warning", {
        withBuffer: percent(figure.floor.withBuffer),
      });
    }
    return t("institution.floor.ok", {
      minimum: percent(figure.floor.minimum),
      withBuffer: percent(figure.floor.withBuffer),
    });
  }
}
