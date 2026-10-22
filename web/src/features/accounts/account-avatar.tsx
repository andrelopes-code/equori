import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountMark } from "@/features/accounts/account-mark";
import { shapeOf } from "@/features/accounts/account-shape";
import { goalsQuery } from "@/features/accounts/api";
import { logoIndexQuery, logoURL } from "@/features/accounts/institution-logo";
import { institutionsQuery } from "@/features/setup";

type Account = components["schemas"]["Account"];

// An account's mark from the account alone: its kind's outline, its institution's logo (else the
// monogram over its colour) and, for a reserve, the progress of the goal it serves. The queries
// are shared, so a list of avatars reads each once.
export function AccountAvatar({
  account,
  size = "md",
}: {
  account: Pick<
    Account,
    "id" | "kind" | "name" | "color" | "institution_id" | "closed_on"
  >;
  size?: "sm" | "md" | "lg";
}) {
  const api = useApi();
  const institutions = useQuery(institutionsQuery(api));
  const index = useQuery(logoIndexQuery);
  const shape = shapeOf(account.kind);
  const goals = useQuery({ ...goalsQuery(api), enabled: shape === "circle" });
  const institution = institutions.data?.find(
    (i) => i.id === account.institution_id,
  );
  const goal = goals.data?.find((g) => g.account_ids.includes(account.id));
  return (
    <AccountMark
      shape={shape}
      size={size}
      name={institution?.name ?? account.name}
      color={account.color}
      logo={
        index.data === undefined
          ? undefined
          : logoURL(index.data, institution?.ispb)
      }
      progress={goal?.progress_bp}
      disabled={account.closed_on !== undefined}
    />
  );
}
