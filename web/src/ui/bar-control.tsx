import { Link } from "@tanstack/react-router";
import { Badge } from "@slotted/react/badge";

import styles from "@/ui/bottom-bar.module.css";
import type { BottomBarItem } from "@/ui/bottom-bar";

export function BarControl({
  item,
  current,
}: {
  item: BottomBarItem;
  current: boolean;
}) {
  const content = (
    <>
      <span className={styles.label}>{item.label}</span>
      {item.badge !== undefined && (
        <Badge tone="warning" size="sm">
          {item.badge}
        </Badge>
      )}
    </>
  );
  if (item.to !== undefined) {
    return (
      <Link
        to={item.to}
        className={styles.control}
        // Link marks only exact paths; aria-current below covers nested routes.
        activeOptions={{ exact: true }}
        aria-current={current ? "page" : undefined}
      >
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.control} onClick={item.onPress}>
      {content}
    </button>
  );
}
