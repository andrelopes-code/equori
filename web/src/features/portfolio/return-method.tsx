import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useScale } from "@/features/setup";
import { formatBasisPoints, formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];
type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnMethodProps {
  report: ReturnReport;
}

// PC12: the two ends, both rates with what sets them apart, and the deposits and withdrawals. An
// expert opens it; a reader who only asked how it performed never has to.
export function ReturnMethod({ report }: ReturnMethodProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const facts: [string, string][] = [
    [t("portfolio.return.opening"), money(report.opening)],
    [t("portfolio.return.closing"), money(report.closing)],
    ...(report.period_bp === undefined
      ? []
      : ([
          [
            t("holdings.method.period"),
            formatBasisPoints(report.period_bp, tag),
          ],
        ] as [string, string][])),
    [t("holdings.method.personal"), formatBasisPoints(report.annual_bp, tag)],
  ];

  return (
    <Collapsible mount="lazy">
      <CollapsibleHeader>
        <CollapsibleTrigger>{t("holdings.method")}</CollapsibleTrigger>
      </CollapsibleHeader>
      <CollapsiblePanel>
        <Stack gap={4}>
          <DescriptionList variant="ruled">
            {facts.map(([term, value]) => (
              <DescriptionListItem key={term}>
                <DescriptionListTerm>{term}</DescriptionListTerm>
                <DescriptionListDescription>
                  <Text size="sm" numeric="tabular">
                    {value}
                  </Text>
                </DescriptionListDescription>
              </DescriptionListItem>
            ))}
          </DescriptionList>

          <Text size="sm" tone="muted">
            {t("holdings.method.difference")}
          </Text>

          {report.flows.length === 0 && (
            <Text size="sm" tone="muted">
              {t("portfolio.return.noFlows")}
            </Text>
          )}

          {report.flows.length > 0 && (
            <Table columns={2} variant="framed">
              <TableContent>
                <TableCaption>{t("portfolio.return.flows")}</TableCaption>
                <TableHead>
                  <TableRow>
                    <TableColumnHeader>
                      {t("portfolio.return.date")}
                    </TableColumnHeader>
                    <TableColumnHeader numeric>
                      {t("portfolio.return.amount")}
                    </TableColumnHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.flows.map((flow, index) => (
                    <TableRow key={`${flow.date}-${String(index)}`}>
                      <TableCell>{formatDate(flow.date, tag)}</TableCell>
                      <TableCell numeric>{money(flow.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableContent>
            </Table>
          )}
        </Stack>
      </CollapsiblePanel>
    </Collapsible>
  );
}
