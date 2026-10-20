import { Badge } from "@slotted/react/badge";
import { useRef } from "react";

import { destinations } from "@/app/shell/destinations";
import { EntryTrigger } from "@/app/shell/entry-trigger";
import { slideRule } from "@/app/shell/slide-rule";
import styles from "@/app/shell/top-bar.module.css";
import { useUncategorizedBadge } from "@/app/shell/use-uncategorized-badge";
import { UserMenu } from "@/app/shell/user-menu";
import { SyncStatus } from "@/features/connections";
import { useT } from "@/i18n/i18n-provider";
import { useTabSelection } from "@/ui/use-tab-selection";

// Families read: top-navigation, tabs, app-shell banner. The banner holds the bar; the bar is
// equori's own by choice: the navigation carries the app's identity and
// is not a gap for the library to fill.
export function TopBar({
  onEntry,
  onReselect,
}: {
  onEntry: () => void;
  onReselect: () => void;
}) {
  const t = useT();
  const badge = useUncategorizedBadge();
  const tabs = useTabSelection(
    destinations.map((d) => d.to),
    onReselect,
  );
  const list = useRef<HTMLUListElement>(null);
  return (
    <div data-own="top-bar" className={styles.bar}>
      <a {...tabs.link("/")} className={styles.brand}>
        {t("app.name")}
      </a>
      <nav aria-label={t("nav.label")} className={styles.nav}>
        <ul ref={list} className={styles.list}>
          {destinations.map((d) => {
            const link = tabs.link(d.to);
            return (
              <li key={d.key} className={styles.item}>
                <a
                  href={link.href}
                  onClick={(event) => {
                    slideRule(list.current, event.currentTarget, () => {
                      link.onClick(event);
                    });
                  }}
                  className={styles.link}
                  aria-current={d.to === tabs.current ? "page" : undefined}
                  {...(d.to === tabs.selected ? { "data-selected": "" } : {})}
                >
                  {t(d.label)}
                  {/* The uncategorized count, discreet. */}
                  {d.key === "transactions" && badge !== undefined && (
                    <span data-own="nav-count" className={styles.count}>
                      <Badge size="sm" tone="secondary">
                        {badge}
                      </Badge>
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={styles.actions}>
        <span className={styles.sync}>
          <SyncStatus />
        </span>
        <EntryTrigger onOpen={onEntry} />
        <UserMenu />
      </div>
    </div>
  );
}
