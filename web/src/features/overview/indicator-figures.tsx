import type { ReactElement } from "react";

import {
  IndicatorFigure,
  type IndicatorKind,
} from "@/features/overview/indicator-figure";
import { placement } from "@/features/overview/overview-block";
import type { MessageKey } from "@/i18n/catalog.en";

const titles: Record<IndicatorKind, MessageKey> = {
  savings_rate: "overview.indicators.savings",
  liquidity: "overview.indicators.reserve",
  committed_share: "overview.indicators.committed",
  debt_service_share: "overview.indicators.debt",
};

const kinds: readonly IndicatorKind[] = [
  "savings_rate",
  "liquidity",
  "committed_share",
  "debt_service_share",
];

// The indicators as widgets of the grid, one each, two to a row at the desk.
export function indicatorFigures(
  month: string,
  t: (key: MessageKey) => string,
): ReactElement[] {
  return kinds.map((kind) => (
    <IndicatorFigure
      key={kind}
      month={month}
      kind={kind}
      {...placement(kind, t(titles[kind]), 6, 2)}
    />
  ));
}
