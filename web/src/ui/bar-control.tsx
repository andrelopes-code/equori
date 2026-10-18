import { Link } from "@tanstack/react-router";

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
        <span data-own="bar-count" className={styles.count}>
          {item.badge}
        </span>
      )}
    </>
  );
  if (item.to !== undefined) {
    return (
      <Link
        to={item.to}
        {...(item.search === undefined ? {} : { search: item.search })}
        className={styles.control}
        // Link marks only exact paths; aria-current below covers nested routes.
        activeOptions={{ exact: true }}
        aria-current={current ? "page" : undefined}
        {...(item.ink === true ? { "data-emphasis": "ink" } : {})}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={styles.control}
      onClick={item.onPress}
      {...(item.ink === true ? { "data-emphasis": "ink" } : {})}
    >
      {content}
    </button>
  );
}
