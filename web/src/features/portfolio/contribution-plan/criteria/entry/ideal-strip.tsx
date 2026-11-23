import type { CSSProperties } from "react";

import styles from "@/features/portfolio/contribution-plan/criteria/entry/criteria-entry.module.css";

interface IdealStripProps {
  // The ideal of each asset inside the group, largest first.
  parts: { name: string; share: number; text: string }[];
}

// The least share whose part holds a code of six letters at the narrowest bar.
const leastNamed = 0.08;

// Families read: meter and progress (one value), chart (an axis). The derived ideals of a group as
// one bar of named parts; a part too narrow for its name keeps it in its title.
export function IdealStrip({ parts }: IdealStripProps) {
  const label = parts.map((part) => `${part.name} ${part.text}`).join(", ");

  return (
    <span role="img" aria-label={label} className={styles.strip}>
      {parts.map((part) => (
        <span
          key={part.name}
          title={`${part.name} ${part.text}`}
          className={styles.part}
          style={{ "--share": String(part.share) } as CSSProperties}
        >
          {part.share >= leastNamed ? part.name : ""}
        </span>
      ))}
    </span>
  );
}
