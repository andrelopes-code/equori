import { FigureHelp } from "@/features/overview/figure-help";
import type { IndicatorKind } from "@/features/overview/indicator-figure";
import { useT } from "@/i18n/i18n-provider";

interface IndicatorHelpProps {
  kind: IndicatorKind;
}

export function IndicatorHelp({ kind }: IndicatorHelpProps) {
  const t = useT();

  const name = names[kind];

  return (
    <FigureHelp
      help={t(`overview.indicators.${name}Help`)}
      formula={t(`overview.indicators.${name}Formula`)}
      example={t(`overview.indicators.${name}Example`)}
    />
  );
}

const names = {
  savings_rate: "savings",
  liquidity: "reserve",
  committed_share: "committed",
  debt_service_share: "debt",
} as const;
