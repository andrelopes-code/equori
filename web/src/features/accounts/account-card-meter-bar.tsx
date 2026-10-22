import type { AccountCardMeter } from "@/features/accounts/account-card-meter";
import styles from "@/features/accounts/account-card.module.css";

const segments = Array.from({ length: 20 }, (_, i) => i);

// Twenty segments of 5%; a state other than normal is told by its text and, for alert and
// over, a warning glyph, never by colour alone.
export function AccountCardMeterBar({
  meter,
  left,
  right,
  valueText,
}: {
  meter: AccountCardMeter;
  left: string;
  right: string;
  valueText: string;
}) {
  const warn = meter.state === "alert" || meter.state === "over";
  return (
    <div
      className={styles.meter}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={Math.max(100, meter.pct)}
      aria-valuenow={meter.pct}
      aria-valuetext={valueText}
      data-state={meter.state}
      // The state colours are the tone tokens of the dark scheme, which hold on the card's ground.
      data-slotted-scheme="dark"
    >
      <div className={styles.meterLabels} aria-hidden="true">
        <span className={styles.meterLeft}>{left}</span>
        <span className={styles.meterRight}>
          {warn && (
            <svg
              className={styles.warning}
              viewBox="0 0 16 14"
              data-warning=""
              focusable="false"
            >
              <path
                d="M8 0.6 15.6 13.4H0.4Z M7.2 5h1.6v4.4H7.2Z M7.2 10.4h1.6v1.6H7.2Z"
                fillRule="evenodd"
              />
            </svg>
          )}
          {right}
        </span>
      </div>
      <div className={styles.segments} aria-hidden="true">
        {segments.map((i) => (
          <span
            key={i}
            className={styles.segment}
            data-segment={
              i < meter.filled
                ? "filled"
                : meter.riskFrom !== undefined && i >= meter.riskFrom
                  ? "risk"
                  : "empty"
            }
          />
        ))}
      </div>
    </div>
  );
}
