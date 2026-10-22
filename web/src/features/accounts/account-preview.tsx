import { Card, CardBody } from "@slotted/react/card";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { AccountDraft } from "@/features/accounts/account-draft";
import {
  kindGroupLabel,
  kindGroups,
  kindTitle,
  yieldCapable,
} from "@/features/accounts/account-kinds";
import { AccountMark } from "@/features/accounts/account-mark";
import { shapeOf } from "@/features/accounts/account-shape";
import { billingPreview } from "@/features/accounts/billing-preview";
import { billingRuleBody } from "@/features/accounts/create-account-steps";
import { logoIndexQuery, logoURL } from "@/features/accounts/institution-logo";
import { institutionsQuery } from "@/features/setup";
import { formatDate, formatMoney, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// FM-14: the account as it will be drawn, where it joins and, for a card, where a purchase made
// today will be billed, before anything is sent.
export function AccountPreview({
  draft,
  scale,
}: {
  draft: AccountDraft;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const institutions = useQuery(institutionsQuery(useApi()));
  const index = useQuery(logoIndexQuery);
  const kind = draft.kind ?? "checking";
  const institution = institutions.data?.find(
    (i) => i.id === draft.institutionId,
  );
  const logo =
    index.data === undefined
      ? undefined
      : logoURL(index.data, institution?.ispb);
  const group =
    kindGroups.find((g) => g.kinds.includes(kind))?.key ?? "accounts";
  const card = draft.card;
  const ruleReady =
    kind === "credit_card" &&
    card.dueDay !== null &&
    (card.closingMode === "day"
      ? card.closingDay !== null
      : card.closingDaysBeforeDue !== null);
  const estimate = ruleReady
    ? billingPreview(billingRuleBody(card, today.slice(0, 7)), today)
    : null;
  const name =
    draft.name.trim() === "" ? t("accountForm.unnamed") : draft.name.trim();
  return (
    <Card>
      <CardBody>
        <Stack gap={4} aria-live="polite">
          <AccountMark
            shape={shapeOf(kind)}
            size="lg"
            name={institution?.name ?? name}
            color={draft.color ?? undefined}
            logo={logo}
          />
          <Stack gap={1}>
            <Text size="lg" weight="semibold">
              {name}
            </Text>
            <Text size="sm" tone="muted">
              {t("accountPreview.kindIn", {
                kind: t(kindTitle[kind]),
                group: t(kindGroupLabel[group]),
              })}
            </Text>
            {institution !== undefined && (
              <Text size="sm" tone="muted">
                {institution.name}
              </Text>
            )}
          </Stack>
          {draft.opening > 0 && (
            <Text size="sm">
              {t(
                kind === "credit_card" || kind === "loan" || kind === "payable"
                  ? "accountPreview.owes"
                  : "accountPreview.holds",
                {
                  amount: formatMoney(
                    { amount: draft.opening, currency: draft.currency },
                    scale(draft.currency),
                    locale,
                  ),
                  date: formatDate(draft.openedOn, locale),
                },
              )}
            </Text>
          )}
          {yieldCapable(kind) && draft.yieldAuto && (
            <Text size="sm">{t("accountPreview.yields")}</Text>
          )}
          {kind === "credit_card" && (
            <Text size="sm">
              {estimate === null
                ? t("accountPreview.ruleMissing")
                : t("accountPreview.placement", {
                    month: formatReferenceMonth(estimate.reference, locale),
                    closing: formatDate(estimate.closing, locale),
                    due: formatDate(estimate.due, locale),
                  })}
            </Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}
