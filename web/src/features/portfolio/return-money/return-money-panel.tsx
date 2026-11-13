import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { HeadingLevel, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { HelpTip } from "@/ui/display/help-tip";
import { useAmountTone } from "@/ui/money/amount-tone";

import { ReturnGrowthBar } from "@/features/portfolio/return-money/return-growth-bar";
import { returnMoney } from "@/features/portfolio/return-money/return-money";
import type { ReturnSubject } from "@/features/portfolio/model/return-summary";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

type ReturnReport = components["schemas"]["ReturnReport"];

const rowKeys = ["opening", "deposits", "gain", "closing"] as const;

interface ReturnMoneyPanelProps {
  report: ReturnReport;
  surface: ReturnSubject;
}

// RC4 states the result in money, each term with its definition (return honesty HR6); RC9 adds
// the growth bar on the portfolio when both the net deposits and the gain are above zero.
export function ReturnMoneyPanel({ report, surface }: ReturnMoneyPanelProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const amountTone = useAmountTone();

  const result = returnMoney(report);
  if (result === undefined) return null;

  const { currency, deposits, gain } = result;
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale?.(currency) ?? 0);
  const amounts = {
    opening: result.opening,
    deposits,
    gain,
    closing: result.closing,
  };
  const rows = rowKeys.filter((key) => key !== "deposits" || result.hasFlows);
  const gainTone = amountTone("result", gain < 0 ? "out" : "none");
  const showBar = surface === "portfolio" && deposits > 0 && gain > 0;

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("return.money.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={4}>
          <DescriptionList variant="ruled">
            {rows.map((key) => (
              <DescriptionListItem key={key}>
                <DescriptionListTerm>
                  {t(`return.money.${key}`)}
                  <HelpTip
                    label={t("return.help.about", {
                      term: t(`return.money.${key}`),
                    })}
                    text={t(`return.help.${key}`)}
                  />
                </DescriptionListTerm>
                <DescriptionListDescription>
                  <Text
                    size="sm"
                    align="end"
                    numeric="tabular"
                    tone={key === "gain" ? gainTone : "inherit"}
                  >
                    {money(amounts[key])}
                  </Text>
                </DescriptionListDescription>
              </DescriptionListItem>
            ))}
          </DescriptionList>

          {showBar && (
            <HeadingLevel>
              <ReturnGrowthBar
                deposits={deposits}
                gain={gain}
                currency={currency}
              />
            </HeadingLevel>
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
