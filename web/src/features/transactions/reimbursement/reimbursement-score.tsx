import type { ReactNode } from "react";

import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { ReimbursementStatus } from "@/features/transactions/reimbursement/reimbursement-status-text";
import {
  meterFraction,
  type StatusLine,
} from "@/features/transactions/reimbursement/reimbursement-status";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface ReimbursementScoreProps {
  inflow: number;
  currency: string;
  scale: number;
  // Absent while the candidates load: the two figures that depend on them wait (RD10).
  totals?: { allocated: number; leftover: number };
  status: StatusLine | "loading";
  // What the waiting figures draw.
  placeholder?: ReactNode;
}

// RD2, RD3: what the inflow brought, what the checked rows take and what stays income, with a
// meter of the share taken. It stays at the top of the scrolling body.
export function ReimbursementScore({
  inflow,
  currency,
  scale,
  totals,
  status,
  placeholder,
}: ReimbursementScoreProps) {
  const t = useT();
  const format = useMoneyFormat();

  const money = (amount: number) => format.money({ amount, currency }, scale);
  const over = totals !== undefined && totals.leftover < 0;
  const fraction =
    totals === undefined ? 0 : meterFraction(totals.allocated, inflow);
  const meterName =
    totals === undefined
      ? undefined
      : t("reimbursement.meter", {
          allocated: money(totals.allocated),
          total: money(inflow),
        });

  return (
    <div className={styles.score}>
      <dl className={styles.figures}>
        <div>
          <dt>{t("reimbursement.received")}</dt>
          <dd>{money(inflow)}</dd>
        </div>

        <div>
          <dt>{t("reimbursement.distributed")}</dt>
          <dd>
            {totals === undefined ? placeholder : money(totals.allocated)}
          </dd>
        </div>

        <div data-tone={over ? "danger" : undefined}>
          <dt>{t(over ? "reimbursement.excess" : "reimbursement.leftover")}</dt>
          <dd>
            {totals === undefined
              ? placeholder
              : money(Math.abs(totals.leftover))}
          </dd>
        </div>
      </dl>

      <div
        className={styles.meter}
        role={totals === undefined ? undefined : "meter"}
        aria-label={meterName}
        aria-valuemin={0}
        aria-valuemax={inflow}
        aria-valuenow={totals?.allocated}
        aria-hidden={totals === undefined ? true : undefined}
        data-over={over ? "" : undefined}
      >
        <span
          className={styles.meterFill}
          style={{ inlineSize: `${String(fraction * 100)}%` }}
        />
      </div>

      <ReimbursementStatus status={status} />
    </div>
  );
}
