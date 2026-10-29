import { DetailPanelSection } from "@slotted/react/detail-panel";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { PostingsTable } from "@/features/transactions/postings-table";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Posting = components["schemas"]["Posting"];

interface MovedAccountsSectionProps {
  postings: readonly Posting[];
  accounts: Map<string, Account>;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
}

// The postings on accounts the reader holds; the category side belongs to the category section.
export function MovedAccountsSection({
  postings,
  accounts,
  categories,
  scale,
}: MovedAccountsSectionProps) {
  const t = useT();

  const moved = postings.filter((p) => !categories.has(p.account_id));
  if (moved.length === 0) return null;

  return (
    <DetailPanelSection
      name="postings"
      label={t("detail.accounts")}
      count={moved.length}
    >
      <PostingsTable postings={moved} accounts={accounts} scale={scale} />
    </DetailPanelSection>
  );
}
