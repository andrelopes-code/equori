import { Button } from "@slotted/react/button";
import { Field, FieldDescription } from "@slotted/react/field";
import { Glyph } from "@slotted/react/icon";
import { useState } from "react";

import { CategoryPicker } from "@/features/categories";
import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

export interface ReimbursementCategoryProps {
  value: string | null;
  exclude: ReadonlySet<string>;
  onChange: (id: string | null) => void;
}

// RD9: the category is optional, so it waits behind a one-line toggle.
export function ReimbursementCategory({
  value,
  exclude,
  onChange,
}: ReimbursementCategoryProps) {
  const t = useT();
  const [open, setOpen] = useState(value !== null);

  return (
    <div className={styles.category}>
      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-expanded={open}
        start={<Glyph name={open ? "chevron-down" : "chevron-right"} />}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {t(open ? "reimbursement.category" : "reimbursement.categoryKeep")}
      </Button>

      {open && (
        <Field className={styles.categoryField}>
          <CategoryPicker
            aria-label={t("reimbursement.category")}
            placeholder={t("reimbursement.categoryPlaceholder")}
            value={value}
            amount={-1}
            exclude={exclude}
            onChange={onChange}
          />
          <FieldDescription>{t("reimbursement.categoryHint")}</FieldDescription>
        </Field>
      )}
    </div>
  );
}
