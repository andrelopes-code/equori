import styles from "@/ui/card-face/card-face.module.css";

interface CardFaceIdentityProps {
  holder: string;
  lastFour: string | undefined;
}

export function CardFaceIdentity({ holder, lastFour }: CardFaceIdentityProps) {
  return (
    <span className={styles.id} aria-hidden="true">
      {lastFour !== undefined && (
        <span className={styles.digits}>
          <span className={styles.dots}>
            <i />
            <i />
            <i />
            <i />
          </span>
          {lastFour}
        </span>
      )}
      {holder !== "" && <span className={styles.holder}>{holder}</span>}
    </span>
  );
}
