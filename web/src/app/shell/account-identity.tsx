import styles from "@/app/shell/account-menu.module.css";
import { useBooks } from "@/app/shell/use-books";

interface AccountIdentityProps {
  name: string;
}

export function AccountIdentity({ name }: AccountIdentityProps) {
  const { items, active } = useBooks();

  return (
    <span className={styles.identity}>
      <span className={styles.name}>{name}</span>
      {items.length >= 2 && (
        <span className={styles.books}>{active?.name}</span>
      )}
    </span>
  );
}
