import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

type ImportBatch = components["schemas"]["ImportBatch"];

interface BatchFiguresProps {
  batch: ImportBatch | undefined;
  pending: boolean;
  scale: (code: string) => number;
}

export function BatchFigures({ batch, pending, scale }: BatchFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const counts = batch?.counts;
  const balance = batch?.balance;
  const amount = balance?.amount;
  const date = balance?.date;
  const recorded =
    balance?.status === "recorded" &&
    amount !== undefined &&
    date !== undefined;

  return (
    <>
      <FigureGrid label={t("batch.figures")}>
        {(
          [
            ["received", "batch.figure.received"],
            ["matched", "batch.figure.matched"],
            ["created", "batch.figure.created"],
            ["needs_review", "batch.figure.needs_review"],
            ["discarded", "batch.figure.discarded"],
            ["ignored", "batch.figure.ignored"],
            ...(batch?.source === "aggregator"
              ? ([
                  ["updated", "batch.figure.updated"],
                  ["withdrawn", "batch.figure.withdrawn"],
                ] as const)
              : []),
          ] as const
        ).map(([key, label]) => (
          <FigureCard
            key={key}
            label={t(label)}
            value={counts === undefined ? undefined : String(counts[key])}
            note={t(`batch.note.${key}`)}
            loading={pending}
          />
        ))}
      </FigureGrid>
      {balance !== undefined && (
        <Text size="sm">
          {recorded &&
            t("batch.balance.recorded", {
              amount: fmt.money(amount, scale(amount.currency)),
              date: formatDate(date, locale),
            })}
          {!recorded &&
            balance.status === "skipped" &&
            t("batch.balance.skipped", { reason: balance.reason ?? "" })}
          {!recorded && balance.status !== "skipped" && t("batch.balance.none")}
        </Text>
      )}
    </>
  );
}
