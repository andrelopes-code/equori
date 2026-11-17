import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { PaymentRows } from "@/features/portfolio/fixed-income/payment-rows";
import kinds from "@/features/portfolio/fixed-income/kind-fill.module.css";
import styles from "@/features/portfolio/fixed-income/payments-timeline.module.css";
import type { ReturnKind } from "@/features/portfolio/fixed-income/return-kind";
import {
  timelineFrom,
  timelinePoints,
} from "@/features/portfolio/fixed-income/timeline-points";
import { formatDate, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Event = components["schemas"]["FixedIncomeEvent"];

interface PaymentsTimelineProps {
  events: readonly Event[];
  names: ReadonlyMap<string, string>;
  kindOf: ReadonlyMap<string, ReturnKind>;
  today: string;
  until: string;
  scale: (code: string) => number;
}

// Own element: the timeline family orders events, it does not place them on a dated axis (families
// read: timeline, chart). A dot per event, a mark for today, the day and month under each dot.
export function PaymentsTimeline({
  events,
  names,
  kindOf,
  today,
  until,
  scale,
}: PaymentsTimelineProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const from = timelineFrom(today);
  const points = timelinePoints(events, from, until);
  const todayAt = timelinePoints(
    [{ instrument: "", date: today, kind: "", state: "" }],
    from,
    until,
  )[0]?.left;

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fixedIncome.next")}</SectionHeading>
          <SectionDescription>
            {t("fixedIncome.next.description", {
              date: formatDate(until, locale),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        {events.length === 0 && (
          <Text tone="muted">{t("fixedIncome.next.none")}</Text>
        )}

        {events.length > 0 && (
          <div className={styles.timeline} aria-hidden="true">
            <div className={styles.axis} />
            <span
              className={styles.today}
              style={{ left: `${String(todayAt)}%` }}
            />
            {points.map((p, i) => (
              <span key={i}>
                <span
                  className={[
                    styles.dot,
                    p.due
                      ? styles.due
                      : kinds[kindOf.get(p.instrument) ?? "none"],
                  ].join(" ")}
                  style={{ left: `${String(p.left)}%` }}
                />
                <span
                  className={styles.date}
                  style={{ left: `${String(p.left)}%` }}
                >
                  {formatDayMonthNumeric(p.date, locale)}
                </span>
              </span>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <PaymentRows events={events} names={names} scale={scale} />
        )}
      </SectionBody>
    </Section>
  );
}
