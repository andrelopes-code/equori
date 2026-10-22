import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { useId } from "react";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

import { AccountCardArt } from "@/features/accounts/account-card-art";
import { AccountCardChip } from "@/features/accounts/account-card-chip";
import type { AccountCardKind } from "@/features/accounts/account-card-kind";
import { accountCardMeter } from "@/features/accounts/account-card-meter";
import { AccountCardMeterBar } from "@/features/accounts/account-card-meter-bar";
import {
  fullMoney,
  moneyParts,
  wholeMoney,
} from "@/features/accounts/account-card-money";
import styles from "@/features/accounts/account-card.module.css";
import { monogram } from "@/features/accounts/account-mark";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const hiddenFigure = "••••";

// Families read: card, stat-card, progress-indicator, meter. A card is a surface of the theme
// and a stat-card one figure on it; this element is the account drawn as a physical card in the
// account's own colour, with a segmented meter whose risk zone and states no family draws. It is
// a deliberate element of equori's visual identity, not a Slotted finding. With an href the whole
// card is one link, named by the card and described by its chip and meter.
export function AccountCard({
  kind,
  color,
  title,
  href,
  onClick,
  institutionName,
  logo,
  currency,
  scale,
  value,
  context,
  meter,
  signal,
  label,
  hidden = false,
  loading = false,
  children,
}: {
  kind: AccountCardKind;
  // A CSS colour; without one the card is a neutral grey.
  color?: string | undefined;
  title: string;
  href?: string | undefined;
  onClick?: MouseEventHandler<HTMLAnchorElement> | undefined;
  // The source of the monogram when there is no logo; the title stands in for it.
  institutionName?: string | undefined;
  logo?: string | undefined;
  currency: string;
  scale: number;
  // Minor units: the balance, the open statement or the amount saved.
  value?: number | undefined;
  context?: string | undefined;
  meter?: { used: number; total: number } | undefined;
  signal?: readonly number[] | undefined;
  label?: string | undefined;
  hidden?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const descriptionId = useId();
  const style = (
    color === undefined ? undefined : { "--account-card-color": color }
  ) as CSSProperties | undefined;
  const parts = (amount: number) => moneyParts(amount, currency, scale, locale);
  const symbol = parts(0).symbol;
  const hiddenAmount = t("accountCard.hiddenAmount", { symbol });
  const whole = (amount: number) =>
    hidden ? hiddenAmount : wholeMoney(parts(amount), locale);

  if (loading) {
    return (
      <article
        className={styles.root}
        style={style}
        data-colour={color === undefined ? undefined : ""}
        aria-label={title}
      >
        {/* The cards of a page load together; the page, not each card, reports the wait. */}
        <SkeletonRegion
          className={styles.card}
          role="group"
          aria-label={t("accountCard.loading")}
          live="off"
        >
          <div className={styles.header}>
            <Skeleton shape="square" inlineSize={22} blockSize={22} />
            <Skeleton inlineSize={96} blockSize={10} />
          </div>
          <div className={styles.value}>
            <Skeleton inlineSize={72} blockSize={8} />
            <Skeleton inlineSize={160} blockSize={26} />
          </div>
          <Skeleton blockSize={5} />
        </SkeletonRegion>
        {children}
      </article>
    );
  }

  const kindWord = t(`accountCard.kind.${kind}`);
  const labelText = label ?? t(`accountCard.label.${kind}`);
  const labelLine =
    context === undefined
      ? labelText
      : t("accountCard.labelContext", { label: labelText, context });
  const labelSpoken =
    context === undefined
      ? labelText.toLocaleLowerCase(locale)
      : t("accountCard.labelContext", {
          label: labelText.toLocaleLowerCase(locale),
          context,
        });
  const amount = value === undefined ? undefined : parts(value);
  const name =
    amount === undefined
      ? t("accountCard.nameNoValue", { title: title, kind: kindWord })
      : t("accountCard.name", {
          title: title,
          kind: kindWord,
          label: labelSpoken,
          amount: hidden ? t("accountCard.hidden") : fullMoney(amount, locale),
        });

  const m =
    meter === undefined
      ? undefined
      : accountCardMeter(kind, meter.used, meter.total);
  const meterLeft =
    m === undefined ? "" : t(m.leftKey, { amount: whole(m.leftAmount) });
  const meterRight = m === undefined ? "" : t(m.rightKey, { pct: m.pct });

  const showSignal = signal !== undefined && signal.length > 1;
  const legend = t(`accountCard.signal.${kind}`);
  const sumParts = parts(signal?.reduce((s, v) => s + v, 0) ?? 0);
  const sum = hidden ? hiddenAmount : fullMoney(sumParts, locale);

  const meterText =
    m === undefined
      ? undefined
      : t("accountCard.meter.text", { right: meterRight, left: meterLeft });
  const signalName = t("accountCard.signalName", { legend, amount: sum });
  const content = (
    <>
      <AccountCardArt kind={kind} />
      <div className={styles.header}>
        <span
          className={styles.tile}
          data-logo={logo === undefined ? undefined : ""}
          aria-hidden="true"
        >
          {logo === undefined ? (
            monogram(institutionName ?? title)
          ) : (
            <img className={styles.logo} src={logo} alt="" />
          )}
        </span>
        <span className={styles.title}>{title}</span>
        <span className={styles.kind} aria-hidden="true">
          {kindWord}
        </span>
      </div>
      {showSignal && (
        <AccountCardChip
          signal={signal}
          legend={legend}
          sum={sum}
          name={signalName}
        />
      )}
      {amount !== undefined && (
        <div className={styles.value} aria-hidden="true">
          <span className={styles.secondary}>{labelLine}</span>
          <span className={styles.amount}>
            <span className={styles.symbol}>
              {amount.sign}
              {amount.symbol}
            </span>{" "}
            <span className={styles.integer}>
              {hidden ? hiddenFigure : amount.integer}
            </span>
            {!hidden && (
              <span className={styles.fraction}>{amount.fraction}</span>
            )}
          </span>
        </div>
      )}
      {m !== undefined && (
        <AccountCardMeterBar
          meter={m}
          left={meterLeft}
          right={meterRight}
          valueText={meterText ?? ""}
        />
      )}
    </>
  );
  const description = [showSignal ? signalName : undefined, meterText]
    .filter((d) => d !== undefined)
    .join("; ");

  return (
    <article
      className={styles.root}
      style={style}
      data-colour={color === undefined ? undefined : ""}
      aria-label={title}
    >
      {href === undefined ? (
        <div className={styles.card} role="group" aria-label={name}>
          {content}
        </div>
      ) : (
        <a
          className={styles.card}
          href={href}
          onClick={onClick}
          aria-label={name}
          aria-describedby={description === "" ? undefined : descriptionId}
        >
          {content}
          <span id={descriptionId} hidden>
            {description}
          </span>
        </a>
      )}
      {children}
    </article>
  );
}
