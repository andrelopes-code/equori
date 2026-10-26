import type { AccountCardMeter } from "@/features/accounts/account-card-meter";
import styles from "@/features/accounts/account-card.module.css";

const segments = Array.from({ length: 20 }, (_, i) => i);

// Twenty segments of 5%; a state other than normal is told by its text, never by colour alone.
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
        <span className={styles.meterRight}>{right}</span>
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
