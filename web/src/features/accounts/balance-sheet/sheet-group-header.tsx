import {
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

type Money = components["schemas"]["Money"];

interface SheetGroupHeaderProps {
  label: string;
  total: Money;
  scale: number;
  share: number | undefined;
}

// The header of a group: its title, its share of the whole under it, its total at the end.
export function SheetGroupHeader({
  label,
  total,
  scale,
  share,
}: SheetGroupHeaderProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const percent =
    share === undefined
      ? undefined
      : numberFormatter(locale, {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(share);

  return (
    <SectionHeader>
      <SectionTitle>
        <SectionHeading>{label}</SectionHeading>
        {percent !== undefined && (
          <SectionDescription>
            {t("balanceSheet.shareOfAssets", { percent })}
          </SectionDescription>
        )}
      </SectionTitle>

      <SectionActions>
        <Text size="md" weight="semibold">
          <MoneyFigure
            amount={total.amount}
            currency={total.currency}
            scale={scale}
          />
        </Text>
      </SectionActions>
    </SectionHeader>
  );
}
