import { Badge } from "@slotted/react/badge";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import styles from "@/app/shell/phone-dock.module.css";
import { ShellIcon } from "@/app/shell/shell-icon";
import { useDestinationPress } from "@/app/shell/use-destination-press";
import { useUncategorizedCount } from "@/app/shell/use-uncategorized-count";
import { useT } from "@/i18n/i18n-provider";
import { SpeedDial } from "@/ui/speed-dial";

const tabs = destinations.filter((d) => d.phone === "bar");

// Families read: app-shell, tabs, side-navigation, top-navigation, button, badge. The dock is
// equori's own by choice, drawn as Android's navigation bar, which no family is meant to imitate.
export function PhoneDock({
  onReselect,
  extent,
}: {
  onReselect: () => void;
  // The dock's block size, which the floating button stands above.
  extent: number;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const count = useUncategorizedCount();
  const { current, topLevel, selected, press } =
    useDestinationPress(onReselect);
  const moreSelected = moreOpen || current?.phone === "more";
  // The entry belongs to the screens where money is read, not to a form or a record.
  const fab = topLevel && current?.phone === "bar";

  return (
    <div className={styles.dock}>
      {fab && (
        <SpeedDial
          tone="accent"
          label={t("nav.create")}
          closeLabel={t("nav.create.close")}
          offset={extent}
          actions={[
            {
              id: "form",
              label: t("nav.new"),
              icon: <ShellIcon name="form" size={20} weight={1.9} />,
              onSelect: () => void navigate({ to: "/transactions/new" }),
            },
            {
              id: "text",
              label: t("capture.title"),
              icon: <ShellIcon name="text" size={20} weight={1.9} />,
              onSelect: () => void navigate({ to: "/transactions/capture" }),
            },
          ]}
        />
      )}
      <nav
        aria-label={t("nav.label")}
        data-own="navigation-bar"
        className={styles.bar}
      >
        <ul className={styles.list}>
          {tabs.map((destination) => {
            const isSelected = selected === destination.key;
            return (
              <li key={destination.key} className={styles.item}>
                <a
                  href={destination.to}
                  className={styles.tab}
                  aria-current={
                    current?.key === destination.key ? "page" : undefined
                  }
                  data-selected={isSelected || undefined}
                  onClick={press(destination)}
                >
                  <span className={styles.indicator}>
                    <ShellIcon
                      name={destination.icon}
                      size={24}
                      weight={isSelected ? 2 : 1.75}
                    />
                    {destination.key === "transactions" &&
                      count !== undefined && (
                        <span className={styles.count}>
                          <Badge size="sm" tone="danger" variant="solid">
                            {count}
                          </Badge>
                        </span>
                      )}
                  </span>
                  <span className={styles.label}>
                    {destination.key === "overview"
                      ? t("nav.home")
                      : t(destination.label)}
                  </span>
                </a>
              </li>
            );
          })}
          <li className={styles.item}>
            <MoreSheet
              onOpenChange={setMoreOpen}
              trigger={(props) => (
                <button
                  {...props}
                  type="button"
                  className={styles.tab}
                  data-selected={moreSelected || undefined}
                >
                  <span className={styles.indicator}>
                    <ShellIcon
                      name="more"
                      size={24}
                      weight={moreSelected ? 2 : 1.75}
                    />
                  </span>
                  <span className={styles.label}>{t("nav.more")}</span>
                </button>
              )}
            />
          </li>
        </ul>
      </nav>
    </div>
  );
}
