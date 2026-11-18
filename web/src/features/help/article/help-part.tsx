import type { ReactNode } from "react";

import styles from "@/features/help/styles/help.module.css";

interface HelpPartProps {
  id: string;
  title: string;
  children: ReactNode;
}

// One section of a page under its title; the id is the anchor of links and of the section list.
export function HelpPart({ id, title, children }: HelpPartProps) {
  return (
    <section className={styles.part} aria-labelledby={id}>
      <h2 className={styles.partTitle} id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}
