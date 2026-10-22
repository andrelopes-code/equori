import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { LineDraft } from "@/features/transactions/capture-draft";
import { CaptureSegments } from "@/features/transactions/capture-segments";
import { EntryKindGlyph } from "@/features/transactions/entry-kind-glyph";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDayMonth, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

type Account = components["schemas"]["Account"];
type CaptureLine = components["schemas"]["CaptureLine"];
type CaptureIssue = components["schemas"]["CaptureIssue"];
type CaptureChoice = components["schemas"]["CaptureChoice"];

// One draft of the capture: the line as written, what will be recorded, and what keeps it
// from being recorded, with the readings to choose from (A115).
export function CaptureLineItem({
  line,
  draft,
  issues,
  problems,
  edited,
  suggested,
  refusal,
  accounts,
  payees,
  baseCurrency,
  scale,
  onChoose,
  onEdit,
}: {
  line: CaptureLine;
  draft: LineDraft;
  issues: readonly CaptureIssue[];
  problems: readonly MessageKey[];
  edited: boolean;
  // The category is a language model's suggestion (ADR 014 L7).
  suggested: boolean;
  refusal: string | null;
  accounts: ReadonlyMap<string, Account>;
  payees: ReadonlyMap<string, string>;
  baseCurrency: string;
  scale: (code: string) => number;
  onChoose: (issue: CaptureIssue, choice: CaptureChoice) => void;
  onEdit: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const name = (id: string | null) =>
    id === null ? null : (accounts.get(id)?.name ?? null);
  const currency =
    (draft.accountId === null ? undefined : accounts.get(draft.accountId))
      ?.currency ?? baseCurrency;
  const blocked = issues.length > 0 || problems.length > 0 || refusal !== null;
  const reading = !edited && draft.kind !== "advanced";

  const facts: string[] = [formatDayMonth(draft.date, locale)];
  const from = name(draft.accountId);
  if (from !== null) {
    const to = draft.kind === "transfer" ? name(draft.toAccountId) : null;
    const account = to === null ? from : `${from} → ${to}`;
    facts.push(
      reading && line.account_source === "default"
        ? `${account} (${t("capture.source.default")})`
        : account,
    );
  }
  if (draft.kind === "expense" || draft.kind === "income") {
    const category = name(draft.categoryId) ?? t("capture.uncategorized");
    const source = suggested
      ? "model"
      : reading && draft.categoryId === line.category_id
        ? line.category_source
        : undefined;
    facts.push(
      source === undefined
        ? category
        : `${category} (${t(`capture.source.${source}`)})`,
    );
    const payee =
      draft.payeeId === null ? undefined : payees.get(draft.payeeId);
    if (payee !== undefined) facts.push(payee);
  }
  if (draft.installments >= 2) {
    facts.push(t("capture.installmentCount", { count: draft.installments }));
  }
  facts.push(...draft.tags.map((tag) => `#${tag}`));
  if (edited) facts.push(t("capture.edited"));

  const choiceLabel = (choice: CaptureChoice) =>
    choice.amount === undefined
      ? (name(choice.account_id ?? null) ?? "")
      : formatMoney(choice.amount, scale(choice.amount.currency), locale);

  return (
    <ListItem align="start" tone={blocked ? "warning" : "secondary"}>
      <ListItemContent>
        <ListItemStart>
          <EntryKindGlyph kind={draft.kind} />
        </ListItemStart>
        <ListItemBody>
          <ListItemLabel>
            {draft.description === ""
              ? t(`entry.kind.${draft.kind}`)
              : draft.description}
          </ListItemLabel>
          <ListItemDescription>
            <Stack gap={2}>
              <CaptureSegments segments={line.segments} />
              <Text size="sm" tone="muted">
                {facts.join(" · ")}
              </Text>
              {issues.map((issue) => (
                <Stack key={issue.code} gap={1}>
                  <InlineMessage tone="warning">
                    {t(`capture.issue.${issue.code}`)}
                  </InlineMessage>
                  {issue.choices.length > 0 && (
                    <Inline gap={2} aria-label={t("capture.choose")}>
                      {issue.choices.map((choice) => (
                        <Button
                          key={choiceLabel(choice)}
                          size="sm"
                          variant="outline"
                          tone="secondary"
                          onClick={() => {
                            onChoose(issue, choice);
                          }}
                        >
                          {choiceLabel(choice)}
                        </Button>
                      ))}
                    </Inline>
                  )}
                </Stack>
              ))}
              {problems.map((key) => (
                <InlineMessage key={key} tone="warning">
                  {t(key)}
                </InlineMessage>
              ))}
              {refusal !== null && (
                <InlineMessage tone="danger">{refusal}</InlineMessage>
              )}
            </Stack>
          </ListItemDescription>
        </ListItemBody>
        <ListItemEnd>
          {draft.kind !== "advanced" && draft.amount > 0 && (
            <MoneyFigure
              amount={draft.amount}
              currency={currency}
              scale={scale(currency)}
            />
          )}
        </ListItemEnd>
      </ListItemContent>
      <ListItemActions>
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          aria-label={t("capture.editLine", { line: line.line })}
          onClick={onEdit}
        >
          {t("capture.edit")}
        </Button>
      </ListItemActions>
    </ListItem>
  );
}
