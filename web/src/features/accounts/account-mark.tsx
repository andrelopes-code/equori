import type { AccountShape } from "@/features/accounts/account-shape";
import styles from "@/features/accounts/account-mark.module.css";

// Families read: avatar, icon. An avatar draws a person as a circle of initials or a photo;
// an account needs its outline to tell its kind, a progress ring for a reserve with a goal, a
// card badge for a credit card and its institution's logo, so the mark is the app's own. Its
// kind is always written beside it, and it stays out of the accessibility tree.
export function AccountMark({
  shape,
  name,
  color,
  logo,
  progress,
  size = "md",
  disabled = false,
}: {
  shape: AccountShape;
  // The institution's name, else the account's: the source of the monogram.
  name: string;
  color?: number | undefined;
  logo?: string | undefined;
  // Basis points of a reserve's goal, 0 to 10000; drawn only on a circle.
  progress?: number | undefined;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}) {
  const ring = shape === "circle" && progress !== undefined;
  return (
    <span
      className={styles.mark}
      data-shape={shape}
      data-size={size}
      data-color={color}
      data-ring={ring || undefined}
      data-disabled={disabled || undefined}
      style={
        ring
          ? {
              ["--mark-progress" as string]: `${String(Math.min(Math.max(progress, 0), 10000) / 100)}%`,
            }
          : undefined
      }
      aria-hidden="true"
    >
      {logo === undefined ? (
        <span className={styles.face}>{monogram(name)}</span>
      ) : (
        <span className={styles.plate}>
          <img className={styles.logo} src={logo} alt="" />
        </span>
      )}
      {shape === "card" && <span className={styles.badge} />}
    </span>
  );
}

// Two letters: the initials of the first two words, or the first two letters of one word.
export function monogram(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w));
  const letters =
    words.length >= 2
      ? [Array.from(words[0] ?? "")[0], Array.from(words[1] ?? "")[0]]
      : Array.from(words[0] ?? "").slice(0, 2);
  return letters.join("").toLocaleUpperCase();
}
