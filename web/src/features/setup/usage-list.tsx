import { Button } from "@slotted/react/button";
import { ListEmpty, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { ProgressBar } from "@slotted/react/progress-indicator";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { useMemo } from "react";

import type { UsageRow } from "@/features/setup/api";
import { usageStatus } from "@/features/setup/usage-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const tones = {
  reached: "danger",
  near: "warning",
  cooling: "warning",
} as const;

function meterTone(used: number, limit: number) {
  if (used >= limit) return "danger";
  return used >= limit * 0.8 ? "warning" : "accent";
}

// The "Usage" group of the assistant section: today's and the period's figures per provider
// and model, against the declared limits (ADR 019 U7).
export function UsageList({
  rows,
  now,
  onLimits,
}: {
  rows: readonly UsageRow[];
  now: Date;
  onLimits: (row: UsageRow) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  const figures = (requests: number, tokens: number, row?: UsageRow) =>
    [
      row?.requests_per_day === undefined
        ? t("assistant.usage.requests", { count: number.format(requests) })
        : t("assistant.usage.requestsOf", {
            count: number.format(requests),
            limit: number.format(row.requests_per_day),
          }),
      row?.tokens_per_day === undefined
        ? t("assistant.usage.tokens", { count: number.format(tokens) })
        : t("assistant.usage.tokensOf", {
            count: number.format(tokens),
            limit: number.format(row.tokens_per_day),
          }),
    ].join(", ");
  const days = rows[0]?.period_days ?? 30;

  return (
    <ListSection label={t("assistant.usage")}>
      {rows.length === 0 && (
        <ListEmpty>
          {t("assistant.usage.empty", { days: String(days) })}
        </ListEmpty>
      )}
      {rows.map((row) => {
        const status = usageStatus(row, now);
        const today = [
          t("assistant.usage.today", {
            figures: figures(row.today_requests, row.today_tokens, row),
          }),
          ...(row.today_errors > 0
            ? [
                t("assistant.usage.errors", {
                  count: number.format(row.today_errors),
                }),
              ]
            : []),
        ].join(" · ");
        return (
          <ListItem key={`${row.provider_id}/${row.model}`}>
            <ListItemContent>
              <ListItemBody>
                <ListItemLabel>
                  {[row.provider_name, row.model].join(" · ")}
                </ListItemLabel>
                <ListItemDescription>
                  {[
                    today,
                    t("assistant.usage.period", {
                      days: String(row.period_days),
                      figures: figures(row.period_requests, row.period_tokens),
                    }),
                  ].join(" · ")}
                </ListItemDescription>
                {(row.requests_per_day !== undefined ||
                  row.tokens_per_day !== undefined) && (
                  <Stack gap={1}>
                    {row.requests_per_day !== undefined && (
                      <ProgressBar
                        size="sm"
                        label={t("assistant.usage.meter.requests")}
                        value={row.today_requests}
                        max={row.requests_per_day}
                        valueText={t("assistant.usage.requestsOf", {
                          count: number.format(row.today_requests),
                          limit: number.format(row.requests_per_day),
                        })}
                        showValue
                        tone={meterTone(
                          row.today_requests,
                          row.requests_per_day,
                        )}
                      />
                    )}
                    {row.tokens_per_day !== undefined && (
                      <ProgressBar
                        size="sm"
                        label={t("assistant.usage.meter.tokens")}
                        value={row.today_tokens}
                        max={row.tokens_per_day}
                        valueText={t("assistant.usage.tokensOf", {
                          count: number.format(row.today_tokens),
                          limit: number.format(row.tokens_per_day),
                        })}
                        showValue
                        tone={meterTone(row.today_tokens, row.tokens_per_day)}
                      />
                    )}
                  </Stack>
                )}
              </ListItemBody>
              {status !== null && (
                <ListItemEnd>
                  <Tag size="sm" tone={tones[status]}>
                    {status === "cooling" && row.cooling_until !== undefined
                      ? t("assistant.usage.cooling", {
                          time: time.format(new Date(row.cooling_until)),
                        })
                      : t(
                          status === "reached"
                            ? "assistant.usage.reached"
                            : "assistant.usage.near",
                        )}
                  </Tag>
                </ListItemEnd>
              )}
            </ListItemContent>
            <ListItemActions>
              <Button
                size="sm"
                variant="ghost"
                tone="secondary"
                onClick={() => {
                  onLimits(row);
                }}
              >
                {t("assistant.usage.limits")}
              </Button>
            </ListItemActions>
          </ListItem>
        );
      })}
    </ListSection>
  );
}
