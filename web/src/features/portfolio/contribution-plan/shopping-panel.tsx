import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import {
  Table,
  TableBody,
  TableCell,
  TableContent,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useRef, useState } from "react";

import type { components } from "@/api/schema.gen";
import { shoppingList } from "@/features/portfolio/contribution-plan/shopping-list";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/shopping-list";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { copyText } from "@/ui/runtime/copy-text";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];

interface ShoppingPanelProps {
  view: Plan;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

const confirmationMs = 2000;

// Every purchase of the split, largest first, and the plain-text copy of the list.
export function ShoppingPanel({ view, memberName }: ShoppingPanelProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  const entries = shoppingList(view, memberName);
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const units = (entry: ShoppingEntry) =>
    entry.quantity === undefined
      ? ""
      : t("contributionPlan.quantity", {
          count: fmt.number(
            { amount: entry.quantity, currency: entry.amount.currency },
            0,
          ),
        });

  function handleCopy() {
    if (host.current === null) return;
    const lines = entries.map((entry) =>
      [entry.name, money(entry.amount), units(entry)]
        .filter((part) => part !== "")
        .join("  "),
    );

    setFailed(false);
    copyText(lines.join("\n"), host.current)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, confirmationMs);
      })
      .catch(() => {
        setFailed(true);
      });
  }

  return (
    <div ref={host}>
      <Section size="lg">
        <SectionHeader>
          <SectionTitle>
            <SectionHeading>{t("contributionPlan.shopping")}</SectionHeading>
          </SectionTitle>

          <SectionActions>
            <Inline gap={4} align="center" wrap="nowrap">
              {failed && (
                <Text size="xs" tone="muted">
                  {t("contributionPlan.copyFailed")}
                </Text>
              )}

              <Button
                size="sm"
                variant="outline"
                tone="secondary"
                disabled={fmt.hidden || entries.length === 0}
                onClick={handleCopy}
              >
                {copied
                  ? t("contributionPlan.copied")
                  : t("contributionPlan.copy")}
              </Button>
            </Inline>
          </SectionActions>
        </SectionHeader>

        <SectionBody>
          {entries.length === 0 && (
            <Text size="sm" tone="muted">
              {t("contributionPlan.shoppingEmpty")}
            </Text>
          )}

          {entries.length > 0 && (
            <Table columns={3} variant="plain">
              <TableContent aria-label={t("contributionPlan.shopping")}>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.name} value={entry.name}>
                      <TableRowHeader text="truncate">
                        {entry.name}
                      </TableRowHeader>

                      <TableCell numeric text="nowrap">
                        <Text size="xs" tone="muted">
                          {units(entry)}
                        </Text>
                      </TableCell>

                      <TableCell numeric text="nowrap">
                        <Text weight="semibold">{money(entry.amount)}</Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableContent>
            </Table>
          )}
        </SectionBody>
      </Section>
    </div>
  );
}
