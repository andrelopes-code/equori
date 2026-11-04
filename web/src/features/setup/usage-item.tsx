import { Button } from "@slotted/react/button";
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

import type { UsageRow } from "@/features/setup/api";
import { usageStatus } from "@/features/setup/usage-rows";
import type { numberFormatter } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";

interface UsageItemProps {
  row: UsageRow;
  now: Date;
  number: ReturnType<typeof numberFormatter>;
  time: Intl.DateTimeFormat;
  onLimits: () => void;
}

const tones = {
  reached: "danger",
  near: "warning",
  cooling: "warning",
} as const;

function meterTone(used: number, limit: number) {
  if (used >= limit) return "danger";
  return used >= limit * 0.8 ? "warning" : "accent";
}

// The usage of one provider and model: today and the period in words, today against each declared
// limit as a meter, and the state of the limit as a tag.
export function UsageItem({
  row,
  now,
  number,
  time,
  onLimits,
}: UsageItemProps) {
  const t = useT();
  const status = usageStatus(row, now);
  const today = [
    t("assistant.usage.today", {
      figures: figures(t, number, row.today_requests, row.today_tokens, row),
    }),
    ...(row.today_errors > 0
      ? [
          t("assistant.usage.errors", {
            count: number.format(row.today_errors),
          }),
        ]
      : []),
  ].join(" · ");
  const period = t("assistant.usage.period", {
    days: String(row.period_days),
    figures: figures(t, number, row.period_requests, row.period_tokens),
  });

  return (
    <ListItem align="start">
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>
            {[row.provider_name, row.model].join(" · ")}
          </ListItemLabel>
          <ListItemDescription>{today}</ListItemDescription>
          <ListItemDescription>{period}</ListItemDescription>
          {(row.requests_per_day !== undefined ||
            row.tokens_per_day !== undefined) && (
            <Stack gap={2}>
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
                  tone={meterTone(row.today_requests, row.requests_per_day)}
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
        <Button size="sm" variant="ghost" tone="secondary" onClick={onLimits}>
          {t("assistant.usage.limits")}
        </Button>
      </ListItemActions>
    </ListItem>
  );
}

// "12 of 50 requests, 3,000 tokens": a figure takes its limit only where one is declared.
function figures(
  t: ReturnType<typeof useT>,
  number: ReturnType<typeof numberFormatter>,
  requests: number,
  tokens: number,
  row?: UsageRow,
) {
  return [
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
}
