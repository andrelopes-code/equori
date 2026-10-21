import { Page, PageBody } from "@slotted/react/page";

import { CategoriesHeader } from "@/features/categories/categories-header";

export function PayeesPage() {
  return (
    <Page width="wide">
      <CategoriesHeader current="payees" />
      <PageBody />
    </Page>
  );
}
