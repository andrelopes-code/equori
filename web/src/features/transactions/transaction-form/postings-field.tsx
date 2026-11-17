import { Field } from "@slotted/react/field";

import { PostingsEditor } from "@/features/transactions/transaction-form/postings-editor";
import type { PostingsEditorProps } from "@/features/transactions/transaction-form/postings-editor";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";

// The postings of an advanced entry, under their title and its help.
export function PostingsField(props: PostingsEditorProps) {
  const t = useT();

  return (
    <Field>
      <FieldTitle
        label={t("detail.postings")}
        help={t("detail.postingsHelp")}
      />
      <PostingsEditor {...props} />
    </Field>
  );
}
