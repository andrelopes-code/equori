import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block/overview-block";
import { UpcomingGroup } from "@/features/overview/upcoming/upcoming-group";
import { UpcomingTotals } from "@/features/overview/upcoming/upcoming-totals";
import styles from "@/features/overview/upcoming/upcoming.module.css";
import { useUpcoming } from "@/features/overview/upcoming/use-upcoming";
import { useT } from "@/i18n/i18n-provider";

// What is overdue, what falls in the next 7 days and what the window adds up to
// (docs/specs/2026-11-17-overview-upcoming-design.md).
export function UpcomingBlock(placement: Placement) {
  const t = useT();
  const { view, base, scale, error, retry } = useUpcoming();

  const loaded = view !== undefined && base !== undefined && scale !== null;
  const rows = loaded ? view.late.length + view.next.length : 0;

  return (
    <OverviewBlock
      placement={placement}
      link={{
        label: t("overview.upcoming.open"),
        options: { to: "/planning" },
      }}
      loading={!loaded && error === null}
      error={error}
      onRetry={retry}
      empty={loaded && rows === 0 ? t("overview.upcoming.empty") : undefined}
      footer={
        loaded && rows > 0 ? (
          <UpcomingTotals
            leaving={view.leaving}
            entering={view.entering}
            scale={scale}
          />
        ) : undefined
      }
    >
      {loaded && (
        <div className={styles.agenda} data-part="agenda">
          <UpcomingGroup
            kind="late"
            entries={view.late}
            sum={{ amount: view.lateSum, currency: base }}
            until={view.until}
            scale={scale}
          />

          <UpcomingGroup
            kind="next"
            entries={view.next}
            sum={{ amount: view.lateSum, currency: base }}
            until={view.until}
            scale={scale}
          />
        </div>
      )}
    </OverviewBlock>
  );
}
