import { Link } from "@tanstack/react-router";

import type { BottomBarItem } from "@/ui/bottom-bar";
import styles from "@/ui/bottom-bar.module.css";
import { IconGlyph } from "@/ui/icon-glyph";

export function BarControl({
  item,
  current,
}: {
  item: BottomBarItem;
  current: boolean;
}) {
  const content = (
    <>
      <span className={styles.glyph}>
        <IconGlyph name={item.glyph} />
      </span>
      <span className={styles.label}>{item.label}</span>
      {/* After the label in reading order; drawn on the glyph's corner. */}
      {item.badge !== undefined && (
        <span data-own="bar-count" className={styles.count}>
          {item.badge}
        </span>
      )}
    </>
  );
  const ink = item.ink === true ? { "data-emphasis": "ink" } : {};
  if (item.to !== undefined) {
    return (
      <Link
        to={item.to}
        {...(item.search === undefined ? {} : { search: item.search })}
        className={styles.control}
        // Link marks only exact paths; aria-current below covers nested routes.
        activeOptions={{ exact: true }}
        aria-current={current ? "page" : undefined}
        {...ink}
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
      {...ink}
    >
      {content}
    </button>
  );
}
