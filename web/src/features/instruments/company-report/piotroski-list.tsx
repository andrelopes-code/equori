import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type {
  Signals,
  SignalUnit,
} from "@/features/instruments/company-report/piotroski";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface PiotroskiListProps {
  signals: Signals | null;
  plan: string;
}

const FORMATS: Record<SignalUnit, Intl.NumberFormatOptions> = {
  percent: {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  ratio2: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  ratio4: { minimumFractionDigits: 4, maximumFractionDigits: 4 },
  shares: { maximumFractionDigits: 0 },
};

// CR11: the signals as facts of the accounts, each with the two values it compares. The state is
// written in words, with no colour by value.
export function PiotroskiList({ signals, plan }: PiotroskiListProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (signals === null) {
    return <Text size="sm">{t("companyReport.signals.few")}</Text>;
  }

  const heading = t("companyReport.signals", {
    year: signals.year.slice(0, 4),
    prior: signals.prior.slice(0, 4),
  });

  return (
    <Stack gap={3}>
      <Text size="sm">{heading}</Text>

      <List aria-label={heading} variant="framed">
        {signals.signals.map((signal) => {
          const current =
            signal.current === null
              ? ""
              : numberFormatter(locale, FORMATS[signal.unit]).format(
                  signal.current,
                );
          const prior =
            signal.prior === null
              ? ""
              : numberFormatter(locale, FORMATS[signal.unit]).format(
                  signal.prior,
                );

          return (
            <ListItem key={signal.id}>
              <ListItemContent>
                <ListItemBody>
                  <ListItemLabel>
                    {t(`companyReport.signal.${signal.id}`)}
                  </ListItemLabel>
                  <ListItemDescription>
                    {signal.prior === null
                      ? current
                      : t("companyReport.signal.compare", { current, prior })}
                  </ListItemDescription>
                </ListItemBody>
                <ListItemEnd>
                  {t(`companyReport.signal.${signal.state}`)}
                </ListItemEnd>
              </ListItemContent>
            </ListItem>
          );
        })}
      </List>

      {plan !== "standard" && (
        <Text size="sm" tone="muted">
          {t("companyReport.signals.notApplicable")}
        </Text>
      )}
    </Stack>
  );
}
