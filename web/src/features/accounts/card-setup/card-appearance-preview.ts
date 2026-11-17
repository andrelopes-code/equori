import type { CardDraft } from "@/features/accounts/model/account-draft";
import type { CardFaceProps } from "@/ui/card-face/card-face";

interface AppearancePreviewInput {
  title: string;
  logo: string | undefined;
  institutionName: string | undefined;
  // The first plastic card row, when there is one.
  row: CardDraft | undefined;
}

// The face the studio draws before the card exists: the account's name, the institution and
// the first plastic card.
export function appearancePreview({
  title,
  logo,
  institutionName,
  row,
}: AppearancePreviewInput): CardFaceProps {
  return {
    title,
    holder: row?.holder.trim() ?? "",
    virtual: row?.virtual ?? false,
    ...(logo === undefined ? {} : { logo }),
    ...(institutionName === undefined ? {} : { institutionName }),
    ...(row === undefined || row.lastFour === ""
      ? {}
      : { lastFour: row.lastFour }),
    ...(row?.network == null ? {} : { network: row.network }),
  };
}
