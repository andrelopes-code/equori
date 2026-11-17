import { useT } from "@/i18n/i18n-provider";
import type { Brand } from "@/ui/card-face/brand";
import styles from "@/ui/card-face/card-face.module.css";
import { CardFaceBrand } from "@/ui/card-face/card-face-brand";
import { CardFaceContactless } from "@/ui/card-face/contactless";

interface CardFaceTopProps {
  title: string;
  holder: string;
  lastFour: string | undefined;
  logo: string | undefined;
  institutionName: string | undefined;
  brand: Brand | undefined;
  color: string;
  virtual: boolean;
  active: boolean;
  peek: boolean;
}

const mask = "••";

export function CardFaceTop({
  title,
  holder,
  lastFour,
  logo,
  institutionName,
  brand,
  color,
  virtual,
  active,
  peek,
}: CardFaceTopProps) {
  const t = useT();

  return (
    <span className={styles.top} data-part="top" aria-hidden="true">
      <CardFaceBrand
        brand={brand}
        logo={logo}
        institutionName={institutionName}
        title={title}
        color={color}
      />

      {peek && (
        <span className={styles.name}>
          {lastFour !== undefined && (
            <span className={styles.peek}>
              {mask} {lastFour}
            </span>
          )}
          {holder}
        </span>
      )}
      {!peek && <span className={styles.name}>{title}</span>}

      {!active && <span className={styles.tag}>{t("cardFace.inactive")}</span>}
      {active && virtual && (
        <span className={styles.tag}>{t("cardFace.virtual")}</span>
      )}
      {active && !virtual && <CardFaceContactless />}
    </span>
  );
}
