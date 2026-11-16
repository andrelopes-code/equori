import { Text } from "@slotted/react/typography";
import { Fragment } from "react";

import type { ModelUse, UsageRow } from "@/features/setup/api";
import { answering, targetState } from "@/features/setup/assistant/use-answer";
import styles from "@/features/setup/usage/use-route.module.css";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

interface UseRouteProps {
  use: ModelUse;
  rows: readonly UsageRow[];
  now: Date;
}

// The chain of a use as a route (spec A7): one numbered stop per target in the order the use
// tries them, the answering one marked. Element of the app's own. Families read: Stepper (its
// steps are a progress the reader walks, with a current step and no struck or resting one), Tag
// (a set of tags has no order and no link between them) and Breadcrumb (a path of destinations).
export function UseRoute({ use, rows, now }: UseRouteProps) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);

  const shown = compact ? use.targets.slice(0, 1) : use.targets;
  const rest = use.targets.length - shown.length;
  const now_ = answering(use, rows, now);
  const list = use.targets
    .map((target, index) => `${String(index + 1)}. ${target.model}`)
    .join(", ");
  const label =
    now_ === undefined
      ? t("assistant.route.labelNone", { list })
      : t("assistant.route.label", { list, model: now_.model });

  if (use.targets.length === 0)
    return (
      <Text size="sm" tone="muted" truncate>
        {t("assistant.use.none")}
      </Text>
    );

  return (
    <ol className={styles.route} aria-label={label}>
      {shown.map((target, index) => (
        <Fragment
          key={`${target.provider_id}/${target.model}/${String(index)}`}
        >
          {index > 0 && <li className={styles.link} aria-hidden="true" />}

          <li
            className={styles.stop}
            data-state={targetState(use, target, rows, now)}
          >
            <span className={styles.position} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.model}>{target.model}</span>
          </li>
        </Fragment>
      ))}
      {rest > 0 && (
        <>
          <li className={styles.link} aria-hidden="true" />

          <li>
            <Text size="sm" tone="muted" numeric="tabular">
              {t("assistant.route.more", { count: String(rest) })}
            </Text>
          </li>
        </>
      )}
    </ol>
  );
}
