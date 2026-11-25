import { wholeShare } from "@/features/portfolio/projection/model/whole-share";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ShareTextProps {
  covered: number | null;
}

// PX18, PX20: the share of the amount needed, or that the other incomes cover the income.
export function ShareText({ covered }: ShareTextProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (covered === null) return t("portfolio.projection.cases.covered");

  return numberFormatter(tag, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(wholeShare(covered));
}
