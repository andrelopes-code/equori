import { Page, PageBody } from "@slotted/react/page";

import { CategoriesHeader } from "@/features/categories/categories-header";

export function RuleEditorPage() {
  return (
    <Page width="content">
      <CategoriesHeader current="rules" />
      <PageBody />
    </Page>
  );
}
