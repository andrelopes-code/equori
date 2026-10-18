import { Link, useRouterState } from "@tanstack/react-router";
import { useId } from "react";

import { destinations } from "@/app/shell/destinations";
import { EntryTrigger } from "@/app/shell/entry-trigger";
import styles from "@/app/shell/ledger-index.module.css";
import { useIndexFigures } from "@/app/shell/use-index-figures";
import { useUncategorizedBadge } from "@/app/shell/use-uncategorized-badge";
import { UserMenu } from "@/app/shell/user-menu";
import { SyncStatus } from "@/features/connections";
import { useT } from "@/i18n/i18n-provider";
import { bestMatch } from "@/ui/best-match";

// Families read: top-navigation, side-navigation, app-shell nav. Both navigations draw a
// destination as a label with an optional badge; none writes a figure beside it, which is the
// index's reason to exist (shell second pass S1): each destination states its number.
export function LedgerIndex() {
  const t = useT();
  const id = useId();
  const figures = useIndexFigures();
  const badge = useUncategorizedBadge();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentPath = bestMatch(
    pathname,
    destinations.map((d) => d.to),
  );
  return (
    <div data-own="ledger-index" className={styles.index}>
      <Link to="/" className={styles.brand}>
        {t("app.name")}
      </Link>
      <EntryTrigger />
      <nav aria-label={t("nav.label")}>
        <ul className={styles.list}>
          {destinations.map((d) => {
            const figure = d.key === "transactions" ? badge : figures[d.key];
            const labelID = `${id}-${d.key}-label`;
            const figureID = `${id}-${d.key}-figure`;
            return (
              <li key={d.key}>
                <Link
                  to={d.to}
                  className={styles.link}
                  aria-current={d.to === currentPath ? "page" : undefined}
                  aria-labelledby={labelID}
                  aria-describedby={figure === undefined ? undefined : figureID}
                >
                  <span id={labelID}>{t(d.label)}</span>
                  {figure !== undefined && (
                    <span
                      id={figureID}
                      className={styles.figure}
                      // Ledger sheet L8: the uncategorized count reads in the warning tone.
                      {...(d.key === "transactions"
                        ? { "data-own": "index-count", "data-tone": "warning" }
                        : {})}
                    >
                      {figure}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={styles.foot}>
        <SyncStatus />
        <UserMenu />
      </div>
    </div>
  );
}
