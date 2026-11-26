import type { LinkOptions } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";
import { artKey, CardFaceArt } from "@/ui/card-face/art";
import type { Brand } from "@/ui/card-face/brand";
import styles from "@/ui/card-face/card-face.module.css";
import { CardFaceIdentity } from "@/ui/card-face/card-face-identity";
import { CardFaceSkeleton } from "@/ui/card-face/card-face-skeleton";
import { CardFaceTop } from "@/ui/card-face/card-face-top";
import { CardFaceChip } from "@/ui/card-face/chip";
import { graphite } from "@/ui/card-face/face-color";
import { darkInk, inkOf, lightInk } from "@/ui/card-face/ink";
import { CardFaceNetwork } from "@/ui/card-face/network/network-mark";
import { useFaceTilt } from "@/ui/card-face/use-face-tilt";
import { routeTo } from "@/ui/navigation/route-to";

export interface CardFaceProps {
  title: string;
  logo?: string;
  institutionName?: string;
  holder: string;
  lastFour?: string;
  network?: string;
  color?: string;
  art?: string;
  chip?: "gold" | "silver";
  orientation?: "horizontal" | "vertical";
  brand?: Brand;
  virtual?: boolean;
  active?: boolean;
  peek?: boolean;
  // What stands at the end of the top strip, in the place of the contactless symbol: an amount
  // the card owes, in a wallet. It inherits the face's ink and its unit (--u).
  note?: ReactNode;
  // What stands inside the face, under its glare: marks engraved on the plastic, placed by the
  // caller in the face's unit (--u) and ink.
  inset?: ReactNode;
  link?: LinkOptions;
  onActivate?: () => void;
  pressed?: boolean;
  loading?: boolean;
}

// Families read: card, stat-card, avatar. A card is a surface of the theme; this element is a
// payment card drawn as the plastic object it is, in the account's colour, with a chip, digits
// and a holder that no family draws. It is a deliberate element of equori's visual identity, not
// a Slotted finding. The face is not an ancestor of a blurred surface (O11), so its descendants
// may use filter, mask and mix-blend-mode.
export function CardFace(props: CardFaceProps) {
  const t = useT();
  const tiltRef = useFaceTilt<HTMLElement>();

  if (props.loading) {
    return <CardFaceSkeleton />;
  }

  const active = props.active !== false;
  const color = props.color ?? graphite;
  const { ink } = inkOf(color);
  const spoken =
    props.lastFour === undefined
      ? props.title
      : t("cardFace.name", { title: props.title, digits: props.lastFour });
  const withVirtual = props.virtual
    ? t("cardFace.nameVirtual", { name: spoken })
    : spoken;
  const name = active
    ? withVirtual
    : t("cardFace.nameInactive", { name: withVirtual });
  const attributes = {
    ref: tiltRef,
    className: styles.face,
    style: {
      "--card-face-color": color,
      "--card-face-ink": ink === "light" ? lightInk : darkInk,
    } as CSSProperties,
    "aria-label": name,
    "data-art": artKey(props.art),
    "data-ink": ink,
    "data-vertical": props.orientation === "vertical" ? "" : undefined,
    "data-inactive": active ? undefined : "",
  };
  const content = (
    <>
      <span className={styles.art} data-part="art" aria-hidden="true">
        <CardFaceArt art={props.art} />
      </span>
      <span className={styles.foil} aria-hidden="true" />
      <span className={styles.foil2} aria-hidden="true" />

      <CardFaceTop
        title={props.title}
        holder={props.holder}
        lastFour={props.lastFour}
        logo={props.logo}
        institutionName={props.institutionName}
        brand={props.brand}
        color={color}
        virtual={props.virtual === true}
        active={active}
        peek={props.peek === true}
        note={props.note}
      />

      <CardFaceChip tone={props.chip ?? "gold"} />

      <CardFaceIdentity holder={props.holder} lastFour={props.lastFour} />

      <span className={styles.net}>
        <CardFaceNetwork network={props.network} />
      </span>
      {props.inset}
      <span className={styles.glare} aria-hidden="true" />
    </>
  );

  return (
    <div className={styles.box}>
      {props.link !== undefined &&
        routeTo(props.link)({ ...attributes, children: content })}
      {props.link === undefined && props.onActivate !== undefined && (
        <button
          {...attributes}
          type="button"
          aria-pressed={props.pressed === true}
          onClick={props.onActivate}
        >
          {content}
        </button>
      )}
      {props.link === undefined && props.onActivate === undefined && (
        <div {...attributes} role="img">
          {content}
        </div>
      )}
    </div>
  );
}
