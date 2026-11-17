import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { logoIndexQuery, logoOf } from "@/features/accounts";
import { cardsQuery, flowsQuery } from "@/features/cards/api";
import styles from "@/features/cards/card-tile/card-tile.module.css";
import { StatementTicket } from "@/features/cards/card-tile/statement-ticket";
import {
  daysSinceMonday,
  weekOutflows,
} from "@/features/cards/card-tile/week-outflows";
import { shiftDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";
import { CardFace } from "@/ui/card-face/card-face";
import { faceColor } from "@/ui/card-face/face-color";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];
type Statement = components["schemas"]["StatementSummary"];

interface CardTileProps {
  account: Account;
  institution: Institution | undefined;
  current: Statement | undefined;
  unpaid: Statement[];
  loading: boolean;
  scale: (code: string) => number;
  // The position in the list; it staggers the entrance of the face.
  index: number;
}

// One credit card: the face of the account, linked to its page, with the statement ticket tucked
// under it.
export function CardTile({
  account,
  institution,
  current,
  unpaid,
  loading,
  scale,
  index,
}: CardTileProps) {
  const api = useApi();
  const today = useToday();
  const elapsed = daysSinceMonday(today);
  const monday = shiftDate(today, -elapsed);
  const flows = useQuery(flowsQuery(api, account.id, monday, today));
  const logos = useQuery(logoIndexQuery);
  const cards = useQuery(cardsQuery(api, account.id));

  const plastic = cards.data?.find((card) => card.active);
  const logo = logoOf(institution?.identifier, logos.data);
  const optional = {
    ...(logo !== undefined && { logo }),
    ...(institution !== undefined && { institutionName: institution.name }),
    ...(plastic !== undefined && { lastFour: plastic.last_four }),
  };
  const signal =
    flows.data === undefined
      ? undefined
      : weekOutflows(monday, elapsed, flows.data);

  return (
    <article className={styles.tile} aria-label={account.name}>
      <div className={styles.face} style={{ "--i": index } as CSSProperties}>
        <CardFace
          title={account.name}
          {...optional}
          color={faceColor(undefined, account.color)}
          holder={plastic?.holder ?? ""}
          active={account.closed_on === undefined}
          link={{
            to: "/cards/$accountId",
            params: { accountId: account.id },
          }}
          loading={loading}
        />
      </div>

      <StatementTicket
        account={account}
        current={current}
        unpaid={unpaid}
        signal={signal}
        scale={scale(unpaid[0]?.unpaid.currency ?? account.currency)}
        loading={loading}
      />
    </article>
  );
}
