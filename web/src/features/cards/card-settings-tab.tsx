import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
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
import { Heading } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { adjustmentLabel } from "@/features/accounts";
import { billingRulesQuery, creditLimitsQuery } from "@/features/cards/api";
import { BillingRuleForm } from "@/features/cards/billing-rule-form";
import { CreditLimitForm } from "@/features/cards/credit-limit-form";
import { PlacementCheck } from "@/features/cards/placement-check";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

// The card's billing cycle and limit, each a history of versions (T05), with the place a
// purchase on a chosen day is billed.
export function CardSettingsTab({
  account,
  ruleOpen,
  onRuleOpen,
  scale,
}: {
  account: Account;
  ruleOpen: boolean;
  onRuleOpen: (open: boolean) => void;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const rules = useQuery(billingRulesQuery(api, account.id));
  const limits = useQuery(creditLimitsQuery(api, account.id));
  const [limitOpen, setLimitOpen] = useState(false);
  const sortedRules = [...(rules.data ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  const sortedLimits = [...(limits.data ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  return (
    <Stack gap={8}>
      <Stack gap={3}>
        <Inline justify="between" gap={3}>
          <Heading level={2} size="md">
            {t("accountForm.billing")}
          </Heading>
          {!ruleOpen && (
            <Button
              variant="outline"
              onClick={() => {
                onRuleOpen(true);
              }}
            >
              {t("card.newRule")}
            </Button>
          )}
        </Inline>
        {ruleOpen && (
          <Card>
            <CardBody>
              <BillingRuleForm
                accountId={account.id}
                latest={sortedRules[0]}
                onCancel={() => {
                  onRuleOpen(false);
                }}
                onDone={() => {
                  onRuleOpen(false);
                  toast.show({ tone: "success", title: t("card.ruleSaved") });
                }}
              />
            </CardBody>
          </Card>
        )}
        <Table columns={4} variant="framed">
          <TableContent>
            <TableCaption>{t("card.ruleVersions")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>{t("card.effectiveFrom")}</TableColumnHeader>
                <TableColumnHeader>{t("card.closing")}</TableColumnHeader>
                <TableColumnHeader>{t("card.due")}</TableColumnHeader>
                <TableColumnHeader>{t("card.nonBusiness")}</TableColumnHeader>
              </TableRow>
            </TableHead>
            {rules.isPending ? (
              <TableLoader skeletonRows={1} />
            ) : (
              <TableBody>
                {sortedRules.length === 0 && (
                  <TableEmpty>{t("card.noRule")}</TableEmpty>
                )}
                {sortedRules.map((rule) => (
                  <TableRow
                    key={rule.effective_from}
                    value={rule.effective_from}
                  >
                    <TableRowHeader>
                      {formatMonthTitle(rule.effective_from, locale)}
                    </TableRowHeader>
                    <TableCell>
                      {rule.closing_mode === "before_due"
                        ? t("card.closingBefore", {
                            days: rule.closing_days_before_due ?? 0,
                          })
                        : t("card.closingOn", { day: rule.closing_day ?? 0 })}
                    </TableCell>
                    <TableCell>
                      {t("card.dueOn", { day: rule.due_day })}
                    </TableCell>
                    <TableCell>
                      {t("card.adjustments", {
                        closing: t(
                          adjustmentLabel[rule.closing_adjustment ?? "none"],
                        ),
                        due: t(
                          adjustmentLabel[rule.due_date_adjustment ?? "none"],
                        ),
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </TableContent>
        </Table>
      </Stack>

      <Stack gap={3}>
        <Inline justify="between" gap={3}>
          <Heading level={2} size="md">
            {t("accountForm.limitGroup")}
          </Heading>
          {!limitOpen && (
            <Button
              variant="outline"
              onClick={() => {
                setLimitOpen(true);
              }}
            >
              {t("card.newLimit")}
            </Button>
          )}
        </Inline>
        {limitOpen && (
          <Card>
            <CardBody>
              <CreditLimitForm
                accountId={account.id}
                currency={account.currency}
                scale={scale(account.currency)}
                onCancel={() => {
                  setLimitOpen(false);
                }}
                onDone={() => {
                  setLimitOpen(false);
                  toast.show({ tone: "success", title: t("card.limitSaved") });
                }}
              />
            </CardBody>
          </Card>
        )}
        <Table columns={2} variant="framed">
          <TableContent>
            <TableCaption>{t("card.limitVersions")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>{t("card.limitFrom")}</TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("accountForm.limit")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            {limits.isPending ? (
              <TableLoader skeletonRows={1} />
            ) : (
              <TableBody>
                {sortedLimits.length === 0 && (
                  <TableEmpty>{t("cards.limitNone")}</TableEmpty>
                )}
                {sortedLimits.map((limit) => (
                  <TableRow
                    key={limit.effective_from}
                    value={limit.effective_from}
                  >
                    <TableRowHeader>
                      {formatDate(limit.effective_from, locale)}
                    </TableRowHeader>
                    <TableCell numeric>
                      {fmt.money(limit.amount, scale(limit.amount.currency))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </TableContent>
        </Table>
      </Stack>

      <Stack gap={3}>
        <Heading level={2} size="md">
          {t("card.simulation")}
        </Heading>
        <PlacementCheck accountId={account.id} />
      </Stack>
    </Stack>
  );
}
