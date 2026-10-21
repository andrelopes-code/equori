import { Page, PageBody } from "@slotted/react/page";

import { CategoriesHeader } from "@/features/categories/categories-header";

export function RulesPage() {
  return (
    <Page width="wide">
      <CategoriesHeader current="rules" />
      <PageBody />
    </Page>
  );
}
