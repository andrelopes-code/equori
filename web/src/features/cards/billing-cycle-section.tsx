import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { toast } from "@slotted/react/toast";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { adjustmentLabel } from "@/features/accounts";
import { billingRulesQuery } from "@/features/cards/api";
import { BillingRuleDialog } from "@/features/cards/billing-rule-dialog";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface BillingCycleSectionProps {
  accountId: string;
  ruleOpen: boolean;
  onRuleOpen: (open: boolean) => void;
}

// T05: the versions of the card's billing cycle, newest first; each day reads with the rule it
// follows on a non-business day.
export function BillingCycleSection({
  accountId,
  ruleOpen,
  onRuleOpen,
}: BillingCycleSectionProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const rules = useQuery(billingRulesQuery(useApi(), accountId));

  const sorted = [...(rules.data ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );

  return (
    <Stack gap={3}>
      <Inline justify="between" gap={3}>
        <Heading level={2} size="md">
          {t("accountForm.billing")}
        </Heading>
        <Button
          variant="outline"
          onClick={() => {
            onRuleOpen(true);
          }}
        >
          {t("card.newRule")}
        </Button>
      </Inline>

      {ruleOpen && (
        <BillingRuleDialog
          accountId={accountId}
          latest={sorted[0]}
          onCancel={() => {
            onRuleOpen(false);
          }}
          onDone={() => {
            onRuleOpen(false);
            toast.show({ tone: "success", title: t("card.ruleSaved") });
          }}
        />
      )}

      <Table columns={3} variant="framed">
        <TableContent>
          <TableCaption>{t("card.ruleVersions")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("card.effectiveFrom")}</TableColumnHeader>
              <TableColumnHeader>{t("card.closing")}</TableColumnHeader>
              <TableColumnHeader>{t("card.due")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {rules.isPending ? (
            <TableLoader skeletonRows={1} />
          ) : (
            <TableBody>
              {sorted.length === 0 && (
                <TableEmpty>{t("card.noRule")}</TableEmpty>
              )}
              {sorted.map((rule) => (
                <TableRow key={rule.effective_from} value={rule.effective_from}>
                  <TableRowHeader>
                    {formatMonthTitle(rule.effective_from, locale)}
                  </TableRowHeader>
                  <TableCell>
                    <Stack gap={1}>
                      <Text size="md">
                        {rule.closing_mode === "before_due"
                          ? t("card.closingBefore", {
                              days: rule.closing_days_before_due ?? 0,
                            })
                          : t("card.closingOn", {
                              day: rule.closing_day ?? 0,
                            })}
                      </Text>
                      <Text size="xs" tone="muted">
                        {t(adjustmentLabel[rule.closing_adjustment ?? "none"])}
                      </Text>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack gap={1}>
                      <Text size="md">
                        {t("card.dueOn", { day: rule.due_day })}
                      </Text>
                      <Text size="xs" tone="muted">
                        {t(adjustmentLabel[rule.due_date_adjustment ?? "none"])}
                      </Text>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
