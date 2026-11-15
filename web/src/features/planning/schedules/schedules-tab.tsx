import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";

import { CommitmentBar } from "@/features/planning/schedules/commitment-bar";
import { EndedSchedules } from "@/features/planning/schedules/ended-schedules";
import { ScheduleTable } from "@/features/planning/schedules/schedule-table";
import { SchedulesSummary } from "@/features/planning/schedules/schedules-summary";
import { useSchedulesData } from "@/features/planning/schedules/use-schedules-data";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/feedback/query-error";

interface SchedulesTabProps {
  onCreate: () => void;
}

// What the fixed commitments take of the fixed income, and the schedules of each kind (docs/specs/2026-11-15-planning-tabs-design.md, section 5).
export function SchedulesTab({ onCreate }: SchedulesTabProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const data = useSchedulesData();

  const scale = data.scale ?? (() => 0);
  const loading = data.schedules.isPending || data.scale === null;
  const total = (monthly: number) =>
    data.currency === undefined
      ? undefined
      : fmt.money(
          { amount: monthly, currency: data.currency },
          scale(data.currency),
        );

  if (data.schedules.isError)
    return (
      <QueryError
        error={data.schedules.error}
        onRetry={() => void data.schedules.refetch()}
      />
    );

  if (!data.schedules.isPending && data.schedules.data.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("schedules.empty")}</ResultStateTitle>
          <ResultStateDescription>
            {t("schedules.emptyHint")}
          </ResultStateDescription>
        </ResultStateContent>
        <ResultStateActions>
          <Button onClick={onCreate}>{t("planning.new")}</Button>
        </ResultStateActions>
      </ResultState>
    );

  return (
    <Stack gap={6}>
      <Stack gap={4}>
        <SchedulesSummary
          commitments={data.commitments}
          scale={data.scale}
          loading={loading}
        />
        {data.commitments !== undefined && data.scale !== null && (
          <CommitmentBar
            commitments={data.commitments}
            scale={data.scale(data.commitments.currency)}
          />
        )}
      </Stack>

      <ScheduleTable
        caption={t("schedules.caption")}
        groups={data.groups.map((group) => ({
          key: group.kind,
          label: t(`schedules.group.${group.kind}`),
          end: total(group.monthly),
          schedules: group.schedules,
        }))}
        accountNames={data.accountNames}
        nextOn={data.nextOn}
        scale={scale}
        loading={loading}
      />

      {!loading && (
        <EndedSchedules
          schedules={data.ended}
          accountNames={data.accountNames}
          scale={scale}
        />
      )}
    </Stack>
  );
}
